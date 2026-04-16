from __future__ import annotations

import logging

from langchain_openai import ChatOpenAI

from app.config import Settings
from app.langchain.agents.support_threads import get_thread_details
from app.langchain.models.categorize import CategorizeResult
from app.langchain.prompts.categorize_prompt import (
    CATEGORIZE_PROMPT,
    CATEGORIZE_PROMPT_NO_CATEGORIES,
)
from app.mcp import call_tool_by_patterns

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
    """Categorize a ticket message using the LLM."""
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


async def update_thread_category(session, thread_id: int, category: str) -> None:
    """Update a thread's category using an existing MCP session."""
    await call_tool_by_patterns(
        session,
        ["update", "thread_category"],
        threadId=thread_id,
        category=category,
        userName="SupportAgent",
    )

    logger.info("Updated thread %d with category: %s", thread_id, category)


async def process_thread(
    session,
    thread_id: int,
    allowed_categories: list[str] | None,
    settings: Settings,
) -> CategorizeResult:
    """Categorize a single thread if it is missing a category."""
    try:
        thread = await get_thread_details(session, thread_id)

        category = thread.get("category")
        if category and str(category).strip():
            return CategorizeResult(id=thread_id, updated=False)

        messages = thread.get("messages", [])
        if not messages:
            return CategorizeResult(id=thread_id, updated=False, error="No messages found in thread")

        first_message = messages[0].get("message", "")
        if not first_message:
            return CategorizeResult(id=thread_id, updated=False, error="First message is empty")

        category = await categorize_message(first_message, allowed_categories, settings)
        await update_thread_category(session, thread_id, category)

        return CategorizeResult(id=thread_id, category=category, updated=True)

    except CategorizationError as exc:
        logger.warning("Categorization failed for thread %s: %s", thread_id, exc)
        return CategorizeResult(id=thread_id, updated=False, error=str(exc))
    except Exception as exc:
        logger.error("Failed to process thread %s: %s", thread_id, exc, exc_info=True)
        return CategorizeResult(id=thread_id, updated=False, error=str(exc))
