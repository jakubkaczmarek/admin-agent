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


_TOOL_TIMEOUT = 30  # seconds


def _run_in_new_loop(coro) -> Any:
    return asyncio.run(asyncio.wait_for(coro, timeout=_TOOL_TIMEOUT))


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
            logger.info("get_support_thread_by_id: calling MCP for thread %s", ticket_id)
            async def _call():
                async with mcp_session(settings) as session:
                    return await call_tool_by_patterns(
                        session, ["get", "support_thread_by_id"], threadId=ticket_id
                    )

            result = _run_in_new_loop(_call())
            logger.info("get_support_thread_by_id: got result for thread %s", ticket_id)
            return _extract_text(result)

    class KBSearchTool(BaseTool):
        name: str = kb_cfg["name"]
        description: str = kb_cfg["description"]
        args_schema: Type[BaseModel] = _KBSearchInput

        def _run(self, query: str) -> str:
            _STOP = {"a","an","the","is","are","was","were","be","been","being",
                     "i","my","we","our","you","your","it","its","do","does","did",
                     "to","of","in","on","at","for","with","and","or","but","not",
                     "how","what","when","where","who","why","can","could","would",
                     "should","will","have","has","had","this","that","these","those"}
            keywords = [w for w in query.lower().split() if w not in _STOP and len(w) > 2]
            if not keywords:
                keywords = query.lower().split()

            logger.info("kb_search: query=%r  keywords=%s", query, keywords)
            matches: list[str] = []
            for txt_file in sorted(documents_dir.glob("*.txt")):
                text = txt_file.read_text(encoding="utf-8")
                para_lower = text.lower()
                for para in text.split("\n\n"):
                    para_l = para.lower()
                    if all(kw in para_l for kw in keywords):
                        matches.append(f"[{txt_file.stem}]\n{para.strip()}")
                        if len(matches) >= 5:
                            break
                if len(matches) >= 5:
                    break

            # fallback: any keyword matches if all-keywords found nothing
            if not matches:
                for txt_file in sorted(documents_dir.glob("*.txt")):
                    text = txt_file.read_text(encoding="utf-8")
                    for para in text.split("\n\n"):
                        para_l = para.lower()
                        if any(kw in para_l for kw in keywords):
                            matches.append(f"[{txt_file.stem}]\n{para.strip()}")
                            if len(matches) >= 5:
                                break
                    if len(matches) >= 5:
                        break

            logger.info("kb_search: returning %d match(es)", len(matches))
            if not matches:
                return "No relevant knowledge base entries found."
            return "\n\n---\n\n".join(matches)

    class CreateSupportMessageTool(BaseTool):
        name: str = create_cfg["name"]
        description: str = create_cfg["description"]
        args_schema: Type[BaseModel] = _CreateSupportMessageInput

        def _run(self, ticket_id: int, content: str) -> str:
            logger.info("create_support_message: sending reply for thread %s", ticket_id)
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
            logger.info("create_support_message: sent reply for thread %s", ticket_id)
            return _extract_text(result)

    tools = [GetSupportThreadTool(), KBSearchTool(), CreateSupportMessageTool()]
    return {t.name: t for t in tools}
