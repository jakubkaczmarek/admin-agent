from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAIError

from app.agents.ticket_agent import (
    TicketGenerationError,
    execute_ticket_generation,
)
from app.config import settings
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
