from __future__ import annotations

import json
import logging
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.models.ticket import TicketPayload
from app.prompts.ticket_prompt import generation_prompt

logger = logging.getLogger(__name__)

LLM_GENERATE_TAG = "generate_tickets"
MCP_SUBMIT_TAG = "submit_tickets"


class TicketGenerationError(Exception):
    """Raised when the LLM fails to generate tickets."""


class MCPSubmissionError(Exception):
    """Raised when MCP submission fails."""


def _build_llm(settings: Settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.7,
    )


async def _generate_tickets_as_json(
    llm: ChatOpenAI,
    prompt_messages: list,
) -> str:
    response = await llm.ainvoke(prompt_messages)
    return response.content


def _parse_ticket_json(raw: str) -> list[dict[str, Any]]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM response as JSON: %s", exc)
        raise TicketGenerationError(
            "LLM returned malformed JSON"
        ) from exc


def _validate_tickets(tickets: list[dict]) -> list[TicketPayload]:
    validated: list[TicketPayload] = []
    for ticket in tickets:
        try:
            validated.append(TicketPayload(**ticket))
        except Exception as exc:
            logger.warning("Skipping invalid ticket object: %s", exc)
    return validated


async def _submit_tickets_with_tools(session) -> list[str]:
    """Submit tickets using loaded MCP tools."""
    tools = await load_mcp_tools(session)
    
    # Find the create_support_thread tool
    submit_tool = None
    for tool in tools:
        if "create_support_thread" in tool.name.lower():
            submit_tool = tool
            break
    
    if not submit_tool:
        tool_names = [t.name for t in tools]
        raise MCPSubmissionError(
            f"create_support_thread tool not found. Available tools: {tool_names}"
        )
    
    return tools, submit_tool


async def execute_ticket_generation(
    tickets_count: int,
    theme: str,
    settings: Settings,
) -> tuple[list[TicketPayload], list[str]]:
    """Run the two-phase ticket generation and submission pipeline.

    Phase 1 — single LLM call to generate all tickets as JSON.
    Phase 2 — sequential MCP tool calls to submit each ticket.
    """
    # Phase 1: Generate tickets using LLM
    llm = _build_llm(settings)
    prompt_messages = generation_prompt.invoke(
        {"tickets_count": tickets_count, "theme": theme}
    ).messages

    raw_json = await _generate_tickets_as_json(llm, prompt_messages)
    ticket_dicts = _parse_ticket_json(raw_json)
    tickets = _validate_tickets(ticket_dicts)

    if not tickets:
        raise TicketGenerationError("No valid tickets generated")

    logger.info("Generated %d valid tickets", len(tickets))

    # Phase 2: Submit tickets via MCP
    client = MultiServerMCPClient({
        "ticketing": {
            "url": settings.mcp_server_url,
            "transport": settings.mcp_transport,
        },
    })
    
    results = []
    async with client.session("ticketing") as session:
        tools = await load_mcp_tools(session)
        
        # Find the create_support_thread tool
        submit_tool = None
        for tool in tools:
            if "create_support_thread" in tool.name.lower():
                submit_tool = tool
                break
        
        if not submit_tool:
            tool_names = [t.name for t in tools]
            raise MCPSubmissionError(
                f"create_support_thread tool not found. Available tools: {tool_names}"
            )
        
        logger.info("Found tool: %s", submit_tool.name)
        
        # Submit each ticket
        for idx, ticket in enumerate(tickets, start=1):
            try:
                payload = ticket.model_dump(by_alias=True, exclude_none=True)
                logger.info("Submitting ticket %d/%d", idx, len(tickets))
                result = await submit_tool.ainvoke(payload)
                results.append(str(result))
                logger.info("Submitted ticket %d/%d", idx, len(tickets))
            except Exception as exc:
                logger.warning(
                    "Failed to submit ticket %d/%d: %s",
                    idx,
                    len(tickets),
                    exc,
                    exc_info=True,
                )
                results.append(f"error: {exc}")

    return tickets, results
