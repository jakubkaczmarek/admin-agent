from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.config import Settings
from app.langchain.agents.support_threads import list_open_threads
from app.mcp import mcp_session

T = TypeVar("T")
logger = logging.getLogger(__name__)


async def run_for_all_threads(
    settings: Settings,
    handler: Callable[[object, int], Awaitable[T]],
) -> list[T]:
    """Open one MCP session, list all active threads, call handler(session, thread_id) for each.

    Extra arguments should be pre-bound via functools.partial or a closure before passing.
    """
    async with mcp_session(settings) as session:
        thread_ids = await list_open_threads(session, settings)
        logger.info("Processing %d threads", len(thread_ids))
        results: list[T] = []
        for thread_id in thread_ids:
            result = await handler(session, thread_id)
            results.append(result)
    return results
