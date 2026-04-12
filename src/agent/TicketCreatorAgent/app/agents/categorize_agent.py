from __future__ import annotations

import json
import logging
from typing import Any

from langchain_openai import ChatOpenAI

from app.config import Settings
from app.mcp import call_tool_by_patterns, mcp_session
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


async def list_open_threads(session, settings: Settings) -> list[int]:
    """List all open thread IDs using an existing MCP session.

    Args:
        session: Active MCP session.
        settings: Application settings.

    Returns:
        A list of open thread IDs (integers).

    Raises:
        RuntimeError: If no matching tool is found.
    """
    result = await call_tool_by_patterns(
        session, ["get", "support_threads"], status="active"
    )

    # The MCP tool returns a list of content blocks like:
    #   [{"type": "text", "text": '{"success":true,"data":{"data":[{"threadId":14,...}]}}'}]
    # We need to parse the JSON string and extract threadId values.
    raw_text = None
    if isinstance(result, list) and len(result) > 0:
        for block in result:
            if isinstance(block, dict) and block.get("type") == "text":
                raw_text = block.get("text")
                break
    elif isinstance(result, dict):
        raw_text = result.get("text") or result.get("data")

    if not raw_text:
        logger.warning("No text content in list threads response: %s", result)
        return []

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error("Failed to parse list threads response as JSON: %s", raw_text[:200])
        return []

    # Navigate: {success: true, data: {data: [...]}}
    wrapper = parsed.get("data") if isinstance(parsed, dict) else parsed
    if isinstance(wrapper, dict):
        items = wrapper.get("data") or wrapper.get("threads") or wrapper.get("results") or []
    elif isinstance(wrapper, list):
        items = wrapper
    else:
        logger.warning("Unexpected parsed structure: %s", wrapper)
        return []

    thread_ids: list[int] = []
    for item in items:
        if isinstance(item, dict):
            tid = item.get("threadId")
            if tid is not None:
                try:
                    thread_ids.append(int(tid))
                except (ValueError, TypeError):
                    logger.warning("Skipping non-numeric threadId: %s", tid)
        elif isinstance(item, (int, float)):
            thread_ids.append(int(item))

    logger.info("Found %d open threads", len(thread_ids))
    return thread_ids


async def get_thread_details(session, thread_id: int) -> dict[str, Any]:
    """Retrieve thread details using an existing MCP session.

    Args:
        session: Active MCP session.
        thread_id: The numeric thread ID.

    Returns:
        The thread details dictionary.

    Raises:
        RuntimeError: If no matching tool is found.
    """
    result = await call_tool_by_patterns(
        session, ["get", "support_thread_by_id"], threadId=thread_id
    )

    # The MCP tool returns a list of content blocks like:
    #   [{"type": "text", "text": '{"success":true,"data":{"threadId":14,...}}'}]
    raw_text = None
    if isinstance(result, list) and len(result) > 0:
        for block in result:
            if isinstance(block, dict) and block.get("type") == "text":
                raw_text = block.get("text")
                break
    elif isinstance(result, dict):
        raw_text = result.get("text")

    if raw_text:
        try:
            parsed = json.loads(raw_text)
            # Navigate: {success: true, data: {...}}
            if isinstance(parsed, dict) and "data" in parsed:
                return parsed["data"]
            return parsed
        except json.JSONDecodeError:
            logger.warning("Failed to parse thread details as JSON: %s", raw_text[:200])

    return result if isinstance(result, dict) else {}


async def update_thread_category(session, thread_id: int, category: str) -> None:
    """Update a thread's category using an existing MCP session.

    Args:
        session: Active MCP session.
        thread_id: The numeric thread ID.
        category: The resolved category name.

    Raises:
        RuntimeError: If no matching tool is found.
    """
    await call_tool_by_patterns(
        session,
        ["update", "thread_category"],
        threadId=thread_id,
        category=category,
        userName="SupportAgent",
    )

    logger.info("Updated thread %d with category: %s", thread_id, category)
