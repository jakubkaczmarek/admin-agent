from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools

from app.config import Settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def mcp_session(settings: Settings):
    """Context manager for an MCP session.

    Usage:
        async with mcp_session(settings) as session:
            tools = await list_tools(session)
            ...
    """
    client = MultiServerMCPClient({
        "ticketing": {
            "url": settings.mcp_server_url,
            "transport": settings.mcp_transport,
        },
    })
    async with client.session("ticketing") as session:
        yield session


async def list_tools(session) -> list:
    """Load and return all MCP tools from the current session."""
    return await load_mcp_tools(session)


def find_tool(tools: list, patterns: list[str]):
    """Find an MCP tool whose name or description contains ALL given patterns.

    Args:
        tools: List of loaded MCP tools.
        patterns: Substring patterns that must ALL be present (case-insensitive).

    Returns:
        The first matching tool, or None.
    """
    for tool in tools:
        searchable = f"{tool.name} {getattr(tool, 'description', '')}".lower()
        if all(pattern in searchable for pattern in patterns):
            return tool
    return None


async def call_tool_by_patterns(session, patterns: list[str], **kwargs) -> Any:
    """Load tools, find one by patterns, and invoke it.

    Args:
        session: Active MCP session.
        patterns: Substring patterns to match against tool name/description.
        **kwargs: Arguments to pass to the tool's ainvoke.

    Returns:
        The tool invocation result.

    Raises:
        RuntimeError: If no matching tool is found.
    """
    tools = await list_tools(session)

    tool = find_tool(tools, patterns)
    if not tool:
        tool_names = [t.name for t in tools]
        raise RuntimeError(
            f"No tool matched patterns {patterns}. Available: {tool_names}"
        )

    return await tool.ainvoke(kwargs)
