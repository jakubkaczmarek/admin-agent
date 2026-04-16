from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.jobs import job_store, schedule_job
from app.langchain.agents.autocomplete_agent import assess_closedown, ClosedownAgentError
from app.langchain.agents.categorize_agent import (
    categorize_message,
    get_thread_details,
    list_open_threads,
    update_thread_category,
    CategorizationError,
)
from app.langchain.agents.ticket_agent import execute_ticket_generation
from app.langchain.models.autocomplete import AutocompleteResponse, AutocompleteResult
from app.langchain.models.categorize import (
    CategorizeAllResponse,
    CategorizeRequest,
    CategorizeResult,
)
from app.langchain.models.jobs import JobAcceptedResponse, JobResponse
from app.langchain.models.ticket import (
    GenerateTicketsRequest,
    GenerateTicketsResponse,
    TicketResponseItem,
)
from app.config import Settings, settings
from app.mcp import call_tool_by_patterns, mcp_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TicketCreatorAgent API")
    try:
        yield
    finally:
        logger.info("Shutting down TicketCreatorAgent API")


app = FastAPI(
    title="Ticket Creator Agent",
    description="Bulk-create support tickets via LLM generation and MCP submission",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Job polling endpoint ---

@app.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    """Poll the status and result of a background job."""
    record = job_store.get(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    execution_time = None
    if record.start_time and record.end_time:
        execution_time = (record.end_time - record.start_time).total_seconds()

    return JobResponse(
        jobId=record.id,
        status=record.status.value,
        startTime=record.start_time,
        endTime=record.end_time,
        executionTime=execution_time,
        result=record.result,
        error=record.error,
    )


# --- Ticket generation endpoint ---

@app.post("/tickets/generate", response_model=JobAcceptedResponse, status_code=202)
async def generate_tickets(request: GenerateTicketsRequest, background_tasks: BackgroundTasks):
    """Generate and submit a batch of support tickets."""
    async def _run() -> GenerateTicketsResponse:
        tickets, _ = await execute_ticket_generation(
            tickets_count=request.tickets_count,
            theme=request.theme,
            settings=settings,
        )
        response_tickets = [
            TicketResponseItem.model_validate(t.model_dump(by_alias=True))
            for t in tickets
        ]
        return GenerateTicketsResponse(submitted=len(response_tickets), tickets=response_tickets)

    job_id = await schedule_job(background_tasks, _run)
    return JobAcceptedResponse(jobId=job_id, status="idle")


# --- Autocomplete endpoint ---

autocomplete_router = APIRouter(prefix="/tickets", tags=["autocomplete"])


async def _process_autocomplete_for_thread(
    session,
    thread_id: int,
    settings: Settings,
) -> AutocompleteResult:
    from datetime import datetime, timezone

    try:
        thread = await get_thread_details(session, thread_id)
        messages = thread.get("messages", [])

        if not messages:
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message="No messages found in thread",
            )

        latest_message_obj = messages[-1]
        author = latest_message_obj.get("creatorUserName", "")

        if author == "SupportAgent":
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message="Last message is from SupportAgent.",
            )

        created_at_str = latest_message_obj.get("createdAt")
        if created_at_str:
            try:
                created_at_str = created_at_str.replace("Z", "+00:00")
                created_at = datetime.fromisoformat(created_at_str)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)

                now = datetime.now(timezone.utc)
                days_old = (now - created_at).total_seconds() / 86400

                if days_old > 7:
                    await call_tool_by_patterns(
                        session,
                        ["create", "support_message"],
                        threadId=thread_id,
                        message="The thread has been automatically closed due to inactivity.",
                        creatorUserName="SupportAgent",
                    )
                    await call_tool_by_patterns(
                        session,
                        ["close", "thread"],
                        threadId=thread_id,
                    )
                    return AutocompleteResult(
                        id=thread_id,
                        action="closed_inactive",
                        message="Closed due to inactivity.",
                    )
            except (ValueError, TypeError) as exc:
                logger.warning("Failed to parse timestamp for thread %d: %s", thread_id, exc)

        latest_message_content = latest_message_obj.get("message", "")
        if not latest_message_content:
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message="Latest message is empty.",
            )

        try:
            assessment = await assess_closedown(latest_message_content, settings)
        except ClosedownAgentError as exc:
            logger.warning("Closedown assessment failed for thread %d: %s", thread_id, exc)
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message=f"Closedown assessment failed: {exc}",
            )

        if assessment.closedownReadiness >= settings.autocomplete_threshold:
            await call_tool_by_patterns(
                session,
                ["create", "support_message"],
                threadId=thread_id,
                message=assessment.suggestedReply,
                creatorUserName="SupportAgent",
            )
            await call_tool_by_patterns(
                session,
                ["close", "thread"],
                threadId=thread_id,
            )
            return AutocompleteResult(
                id=thread_id,
                action="closed_resolved",
                message=assessment.suggestedReply,
            )
        else:
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message=f"Closedown readiness below threshold ({assessment.closedownReadiness:.2f}).",
            )

    except Exception as exc:
        logger.error("Failed to process thread %d for autocomplete: %s", thread_id, exc, exc_info=True)
        return AutocompleteResult(
            id=thread_id,
            action="skipped",
            message=f"Error processing thread: {exc}",
        )


@autocomplete_router.post("/all/autocomplete", response_model=JobAcceptedResponse, status_code=202)
async def autocomplete_all_tickets(background_tasks: BackgroundTasks):
    """Scan all open tickets and automatically close resolved or inactive ones."""
    async def _run() -> AutocompleteResponse:
        async with mcp_session(settings) as session:
            thread_ids = await list_open_threads(session, settings)
            results: list[AutocompleteResult] = []
            for thread_id in thread_ids:
                result = await _process_autocomplete_for_thread(session, thread_id, settings)
                results.append(result)
        return AutocompleteResponse(processed=len(results), results=results)

    job_id = await schedule_job(background_tasks, _run)
    return JobAcceptedResponse(jobId=job_id, status="idle")


app.include_router(autocomplete_router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# --- Categorization endpoint ---

categorize_router = APIRouter(prefix="/tickets", tags=["categorization"])


async def _process_single_ticket(
    session,
    thread_id: int,
    allowed_categories: list[str] | None,
) -> CategorizeResult:
    try:
        thread = await get_thread_details(session, thread_id)

        category = thread.get("category")
        if category and str(category).strip():
            return CategorizeResult(id=thread_id, updated=False)

        messages = thread.get("messages", [])
        if not messages:
            return CategorizeResult(id=thread_id, updated=False, error="No messages found in thread")

        first_message = messages[0].get("message", "")
        if not first_message:
            return CategorizeResult(id=thread_id, updated=False, error="First message is empty")

        category = await categorize_message(first_message, allowed_categories, settings)
        await update_thread_category(session, thread_id, category)

        return CategorizeResult(id=thread_id, category=category, updated=True)

    except CategorizationError as exc:
        logger.warning("Categorization failed for thread %s: %s", thread_id, exc)
        return CategorizeResult(id=thread_id, updated=False, error=str(exc))
    except Exception as exc:
        logger.error("Failed to process thread %s: %s", thread_id, exc, exc_info=True)
        return CategorizeResult(id=thread_id, updated=False, error=str(exc))


@categorize_router.post("/all/categorize", response_model=JobAcceptedResponse, status_code=202)
async def categorize_all_tickets(request: CategorizeRequest, background_tasks: BackgroundTasks):
    """Categorize all open tickets that are missing a category."""
    async def _run() -> CategorizeAllResponse:
        async with mcp_session(settings) as session:
            thread_ids = await list_open_threads(session, settings)
            results: list[CategorizeResult] = []
            skipped = 0
            updated_count = 0
            for thread_id in thread_ids:
                result = await _process_single_ticket(session, thread_id, request.allowed_categories)
                results.append(result)
                if result.updated:
                    updated_count += 1
                elif not result.error:
                    skipped += 1
        return CategorizeAllResponse(processed=updated_count, skipped=skipped, results=results)

    job_id = await schedule_job(background_tasks, _run)
    return JobAcceptedResponse(jobId=job_id, status="idle")


app.include_router(categorize_router)
