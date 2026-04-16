from __future__ import annotations

import functools
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.jobs import job_store, schedule_job
from app.langchain.agents.autocomplete_agent import process_thread as autocomplete_thread
from app.langchain.agents.categorize_agent import process_thread as categorize_thread
from app.langchain.agents.ticket_agent import execute_ticket_generation
from app.langchain.models.autocomplete import AutocompleteResponse
from app.langchain.models.categorize import CategorizeAllResponse, CategorizeRequest
from app.langchain.models.jobs import JobAcceptedResponse, JobResponse
from app.langchain.models.ticket import (
    GenerateTicketsRequest,
    GenerateTicketsResponse,
    TicketResponseItem,
)
from app.support_threads_orchestrator import run_for_all_threads

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


@autocomplete_router.post("/all/autocomplete", response_model=JobAcceptedResponse, status_code=202)
async def autocomplete_all_tickets(background_tasks: BackgroundTasks):
    """Scan all open tickets and automatically close resolved or inactive ones."""
    async def _run() -> AutocompleteResponse:
        results = await run_for_all_threads(
            settings,
            functools.partial(autocomplete_thread, settings=settings),
        )
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


@categorize_router.post("/all/categorize", response_model=JobAcceptedResponse, status_code=202)
async def categorize_all_tickets(request: CategorizeRequest, background_tasks: BackgroundTasks):
    """Categorize all open tickets that are missing a category."""
    async def _run() -> CategorizeAllResponse:
        results = await run_for_all_threads(
            settings,
            functools.partial(
                categorize_thread,
                allowed_categories=request.allowed_categories,
                settings=settings,
            ),
        )
        updated = sum(1 for r in results if r.updated)
        skipped = sum(1 for r in results if not r.updated and not r.error)
        return CategorizeAllResponse(processed=updated, skipped=skipped, results=results)

    job_id = await schedule_job(background_tasks, _run)
    return JobAcceptedResponse(jobId=job_id, status="idle")


app.include_router(categorize_router)
