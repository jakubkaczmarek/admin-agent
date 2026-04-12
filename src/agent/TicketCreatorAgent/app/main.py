from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAIError

from app.agents.categorize_agent import (
    CategorizationError,
    categorize_message,
    get_thread_details,
    list_open_threads,
    update_thread_category,
)
from app.agents.ticket_agent import (
    TicketGenerationError,
    execute_ticket_generation,
)
from app.config import settings
from app.mcp import mcp_session
from app.models.categorize import (
    CategorizeAllResponse,
    CategorizeRequest,
    CategorizeResult,
)
from app.models.ticket import (
    GenerateTicketsRequest,
    GenerateTicketsResponse,
    TicketResponseItem,
)

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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post(
    "/tickets/generate",
    response_model=GenerateTicketsResponse,
    status_code=201,
)
async def generate_tickets(request: GenerateTicketsRequest):
    """Generate and submit a batch of support tickets."""
    try:
        tickets, results = await execute_ticket_generation(
            tickets_count=request.tickets_count,
            theme=request.theme,
            settings=settings,
        )
    except TicketGenerationError as exc:
        logger.error("Ticket generation failed: %s", exc)
        return JSONResponse(
            status_code=502,
            content={"detail": str(exc)},
        )
    except OpenAIError as exc:
        logger.error("OpenAI API error: %s", exc)
        return JSONResponse(
            status_code=502,
            content={"detail": f"LLM provider error: {exc}"},
        )
    except Exception as exc:
        logger.error("Unexpected error during ticket generation: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": f"Service error: {exc}"},
        )

    response_tickets = [
        TicketResponseItem.model_validate(t.model_dump(by_alias=True))
        for t in tickets
    ]

    return GenerateTicketsResponse(
        submitted=len(response_tickets),
        tickets=response_tickets,
    )


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
    """Process a single ticket: check category, categorize if missing, update."""
    try:
        thread = await get_thread_details(session, thread_id)

        # Check if category already exists
        category = thread.get("category")
        if category and str(category).strip():
            return CategorizeResult(id=thread_id, updated=False)

        # Extract first message content
        messages = thread.get("messages", [])
        if not messages:
            return CategorizeResult(
                id=thread_id,
                updated=False,
                error="No messages found in thread",
            )

        first_message = messages[0].get("message", "")
        if not first_message:
            return CategorizeResult(
                id=thread_id,
                updated=False,
                error="First message is empty",
            )

        # Categorize the message
        category = await categorize_message(
            first_message, allowed_categories, settings
        )

        # Update the thread category
        await update_thread_category(session, thread_id, category)

        return CategorizeResult(id=thread_id, category=category, updated=True)

    except CategorizationError as exc:
        logger.warning("Categorization failed for thread %s: %s", thread_id, exc)
        return CategorizeResult(id=thread_id, updated=False, error=str(exc))
    except Exception as exc:
        logger.error(
            "Failed to process thread %s: %s",
            thread_id,
            exc,
            exc_info=True,
        )
        return CategorizeResult(id=thread_id, updated=False, error=str(exc))


@categorize_router.post(
    "/all/categorize", response_model=CategorizeAllResponse
)
async def categorize_all_tickets(request: CategorizeRequest):
    """Categorize all open tickets that are missing a category."""
    allowed = request.allowed_categories

    # Single session for the entire batch
    async with mcp_session(settings) as session:
        # Get all open threads
        try:
            thread_ids = await list_open_threads(session, settings)
        except Exception as exc:
            logger.error("Failed to list open threads: %s", exc)
            return JSONResponse(
                status_code=502,
                content={"detail": f"Failed to list open threads: {exc}"},
            )

        results: list[CategorizeResult] = []
        skipped = 0
        updated_count = 0

        for thread_id in thread_ids:
            result = await _process_single_ticket(session, thread_id, allowed)
            results.append(result)
            if not result.updated and not result.error:
                skipped += 1
            elif result.updated:
                updated_count += 1

    return CategorizeAllResponse(
        processed=updated_count,
        skipped=skipped,
        results=results,
    )


app.include_router(categorize_router)
