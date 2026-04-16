from __future__ import annotations

import json
import logging
from typing import Any

from app.config import Settings
from app.mcp import call_tool_by_patterns

logger = logging.getLogger(__name__)


async def list_open_threads(session, settings: Settings) -> list[int]:
    """List all open thread IDs using an existing MCP session."""
    result = await call_tool_by_patterns(
        session, ["get", "support_threads"], status="active"
    )

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
    """Retrieve thread details using an existing MCP session."""
    result = await call_tool_by_patterns(
        session, ["get", "support_thread_by_id"], threadId=thread_id
    )

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
            if isinstance(parsed, dict) and "data" in parsed:
                return parsed["data"]
            return parsed
        except json.JSONDecodeError:
            logger.warning("Failed to parse thread details as JSON: %s", raw_text[:200])

    return result if isinstance(result, dict) else {}
