from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Type

import yaml
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.config import Settings
from app.mcp import call_tool_by_patterns, mcp_session

logger = logging.getLogger(__name__)

_TOOLS_DIR = Path(__file__).parent


def _load_yaml(filename: str) -> dict:
    with open(_TOOLS_DIR / filename) as f:
        return yaml.safe_load(f)


def _run_in_new_loop(coro) -> Any:
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _extract_text(result: Any) -> str:
    """Extract text from an MCP tool response."""
    raw_text = None
    if isinstance(result, list):
        for block in result:
            if isinstance(block, dict) and block.get("type") == "text":
                raw_text = block.get("text")
                break
    elif isinstance(result, dict):
        raw_text = result.get("text") or result.get("data")
    return raw_text or str(result)


class _GetSupportThreadInput(BaseModel):
    ticket_id: int = Field(description="The numeric ID of the support thread.")


class _KBSearchInput(BaseModel):
    query: str = Field(description="Natural language search query.")


class _CreateSupportMessageInput(BaseModel):
    ticket_id: int = Field(description="The numeric ID of the support thread.")
    content: str = Field(description="The message body to send.")


def make_tools(settings: Settings) -> dict[str, BaseTool]:
    """Return all three tool instances keyed by tool name."""
    get_cfg = _load_yaml("get_support_thread.yaml")
    kb_cfg = _load_yaml("kb_search.yaml")
    create_cfg = _load_yaml("create_support_message.yaml")
    documents_dir = _TOOLS_DIR.parent / "documents"

    class GetSupportThreadTool(BaseTool):
        name: str = get_cfg["name"]
        description: str = get_cfg["description"]
        args_schema: Type[BaseModel] = _GetSupportThreadInput

        def _run(self, ticket_id: int) -> str:
            async def _call():
                async with mcp_session(settings) as session:
                    return await call_tool_by_patterns(
                        session, ["get", "support_thread_by_id"], threadId=ticket_id
                    )

            result = _run_in_new_loop(_call())
            return _extract_text(result)

    class KBSearchTool(BaseTool):
        name: str = kb_cfg["name"]
        description: str = kb_cfg["description"]
        args_schema: Type[BaseModel] = _KBSearchInput

        def _run(self, query: str) -> str:
            query_lower = query.lower()
            matches: list[str] = []
            for txt_file in sorted(documents_dir.glob("*.txt")):
                text = txt_file.read_text(encoding="utf-8")
                for para in text.split("\n\n"):
                    if any(word in para.lower() for word in query_lower.split()):
                        matches.append(f"[{txt_file.stem}]\n{para.strip()}")
                        if len(matches) >= 5:
                            break
                if len(matches) >= 5:
                    break

            if not matches:
                return "No relevant knowledge base entries found."
            return "\n\n---\n\n".join(matches)

    class CreateSupportMessageTool(BaseTool):
        name: str = create_cfg["name"]
        description: str = create_cfg["description"]
        args_schema: Type[BaseModel] = _CreateSupportMessageInput

        def _run(self, ticket_id: int, content: str) -> str:
            async def _call():
                async with mcp_session(settings) as session:
                    return await call_tool_by_patterns(
                        session,
                        ["create", "support_message"],
                        threadId=ticket_id,
                        message=content,
                        creatorUserName="SupportAgent",
                    )

            result = _run_in_new_loop(_call())
            return _extract_text(result)

    tools = [GetSupportThreadTool(), KBSearchTool(), CreateSupportMessageTool()]
    return {t.name: t for t in tools}
