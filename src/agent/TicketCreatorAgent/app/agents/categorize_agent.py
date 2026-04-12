from __future__ import annotations

import logging
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.prompts.categorize_prompt import (
    CATEGORIZE_PROMPT,
    CATEGORIZE_PROMPT_NO_CATEGORIES,
)

logger = logging.getLogger(__name__)


class CategorizationError(Exception):
    """Raised when the categorization agent returns an invalid category."""


def _build_llm(settings: Settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
    )


async def categorize_message(
    message: str,
    allowed_categories: list[str] | None,
    settings: Settings,
) -> str:
    """Categorize a ticket message using the LLM.

    Args:
        message: The content of the first ticket message.
        allowed_categories: Optional list of allowed category names.
        settings: Application settings.

    Returns:
        The chosen category name.

    Raises:
        CategorizationError: If allowed_categories is provided and the model
            returns a value outside the list.
    """
    llm = _build_llm(settings)

    if allowed_categories:
        categories_str = ", ".join(f'"{c}"' for c in allowed_categories)
        prompt_messages = CATEGORIZE_PROMPT.invoke(
            {"message": message, "allowed_categories": categories_str}
        ).messages
    else:
        prompt_messages = CATEGORIZE_PROMPT_NO_CATEGORIES.invoke(
            {"message": message}
        ).messages

    response = await llm.ainvoke(prompt_messages)
    raw_category = str(response.content).strip().strip('"').strip("'").strip()

    if allowed_categories:
        if raw_category not in allowed_categories:
            raise CategorizationError(
                f"Model returned category '{raw_category}' not in allowed list: {allowed_categories}"
            )

    return raw_category


def _find_tool_by_patterns(tools: list, patterns: list[str]) -> Any:
    """Find an MCP tool by matching its name or description against patterns.

    Args:
        tools: List of loaded MCP tools.
        patterns: List of substring patterns to match against tool name/description.

    Returns:
        The first matching tool, or None if not found.
    """
    for tool in tools:
        searchable = f"{tool.name} {getattr(tool, 'description', '')}".lower()
        if any(pattern in searchable for pattern in patterns):
            return tool
    return None


async def get_thread_details(
    ticket_id: int,
    settings: Settings,
) -> dict[str, Any]:
    """Retrieve thread details from the MCP server.

    Args:
        ticket_id: The ticket/thread ID.
        settings: Application settings.

    Returns:
        The thread details dictionary.

    Raises:
        RuntimeError: If no matching tool is found.
    """
    client = MultiServerMCPClient({
        "ticketing": {
            "url": settings.mcp_server_url,
            "transport": settings.mcp_transport,
        },
    })

    async with client.session("ticketing") as session:
        tools = await load_mcp_tools(session)

        get_tool = _find_tool_by_patterns(
            tools, ["get", "thread", "details"]
        )
        if not get_tool:
            tool_names = [t.name for t in tools]
            raise RuntimeError(
                f"Get thread tool not found. Available tools: {tool_names}"
            )

        result = await get_tool.ainvoke({"supportThreadId": ticket_id})
        return result


async def update_thread_category(
    ticket_id: int,
    category: str,
    settings: Settings,
) -> None:
    """Update a thread's category via the MCP server.

    Args:
        ticket_id: The ticket/thread ID.
        category: The resolved category name.
        settings: Application settings.

    Raises:
        RuntimeError: If no matching tool is found.
    """
    client = MultiServerMCPClient({
        "ticketing": {
            "url": settings.mcp_server_url,
            "transport": settings.mcp_transport,
        },
    })

    async with client.session("ticketing") as session:
        tools = await load_mcp_tools(session)

        update_tool = _find_tool_by_patterns(
            tools, ["update", "patch", "category"]
        )
        if not update_tool:
            tool_names = [t.name for t in tools]
            raise RuntimeError(
                f"Update thread tool not found. Available tools: {tool_names}"
            )

        await update_tool.ainvoke({
            "supportThreadId": ticket_id,
            "categoryName": category,
            "userName": "SupportAgent",
        })

    logger.info("Updated thread %d with category: %s", ticket_id, category)


async def list_open_threads(settings: Settings) -> list[int]:
    """List all open thread IDs from the MCP server.

    Args:
        settings: Application settings.

    Returns:
        A list of open thread IDs.

    Raises:
        RuntimeError: If no matching tool is found.
    """
    client = MultiServerMCPClient({
        "ticketing": {
            "url": settings.mcp_server_url,
            "transport": settings.mcp_transport,
        },
    })

    async with client.session("ticketing") as session:
        tools = await load_mcp_tools(session)

        list_tool = _find_tool_by_patterns(
            tools, ["list", "threads", "all"]
        )
        if not list_tool:
            tool_names = [t.name for t in tools]
            raise RuntimeError(
                f"List threads tool not found. Available tools: {tool_names}"
            )

        result = await list_tool.ainvoke({})
        # The result may be a list of dicts with 'id' key, or a list of IDs
        if isinstance(result, list):
            threads = []
            for item in result:
                if isinstance(item, dict):
                    threads.append(item.get("id"))
                else:
                    threads.append(item)
            return [tid for tid in threads if tid is not None]
        logger.warning("Unexpected result from list threads tool: %s", result)
        return []
