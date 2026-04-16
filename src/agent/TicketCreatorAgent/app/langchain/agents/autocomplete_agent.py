from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from langchain_openai import ChatOpenAI

from app.config import Settings
from app.langchain.agents.support_threads import get_thread_details
from app.langchain.models.autocomplete import AutocompleteResult
from app.langchain.prompts.autocomplete_prompt import AUTOCOMPLETE_PROMPT
from app.mcp import call_tool_by_patterns

logger = logging.getLogger(__name__)


class ClosedownAgentError(Exception):
    """Raised when the closedown agent returns an invalid response."""


@dataclass
class ClosedownAssessment:
    closedownReadiness: float
    suggestedReply: str


def _build_llm(settings: Settings) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
    )


async def assess_closedown(
    latest_message: str,
    settings: Settings,
) -> ClosedownAssessment:
    """Assess whether a ticket is ready to be closed."""
    llm = _build_llm(settings)

    prompt_messages = AUTOCOMPLETE_PROMPT.invoke(
        {"message": latest_message}
    ).messages

    response = await llm.ainvoke(prompt_messages)
    raw_content = str(response.content).strip()

    if raw_content.startswith("```"):
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        elif raw_content.startswith("```"):
            raw_content = raw_content[3:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
        raw_content = raw_content.strip()

    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse closedown assessment as JSON: %s", raw_content[:200])
        raise ClosedownAgentError(
            f"Invalid JSON response from closedown agent: {exc}"
        ) from exc

    if "closedownReadiness" not in parsed or "suggestedReply" not in parsed:
        raise ClosedownAgentError(
            f"Missing required fields in closedown assessment: {parsed}"
        )

    readiness = float(parsed["closedownReadiness"])
    readiness = max(0.0, min(1.0, readiness))

    return ClosedownAssessment(
        closedownReadiness=readiness,
        suggestedReply=str(parsed["suggestedReply"]),
    )


async def process_thread(
    session,
    thread_id: int,
    settings: Settings,
) -> AutocompleteResult:
    """Assess and potentially close a single thread."""
    try:
        thread = await get_thread_details(session, thread_id)
        messages = thread.get("messages", [])

        if not messages:
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message="No messages found in thread",
            )

        latest_message_obj = messages[-1]
        author = latest_message_obj.get("creatorUserName", "")

        if author == "SupportAgent":
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message="Last message is from SupportAgent.",
            )

        created_at_str = latest_message_obj.get("createdAt")
        if created_at_str:
            try:
                created_at_str = created_at_str.replace("Z", "+00:00")
                created_at = datetime.fromisoformat(created_at_str)
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)

                now = datetime.now(timezone.utc)
                days_old = (now - created_at).total_seconds() / 86400

                if days_old > 7:
                    await call_tool_by_patterns(
                        session,
                        ["create", "support_message"],
                        threadId=thread_id,
                        message="The thread has been automatically closed due to inactivity.",
                        creatorUserName="SupportAgent",
                    )
                    await call_tool_by_patterns(
                        session,
                        ["close", "thread"],
                        threadId=thread_id,
                    )
                    return AutocompleteResult(
                        id=thread_id,
                        action="closed_inactive",
                        message="Closed due to inactivity.",
                    )
            except (ValueError, TypeError) as exc:
                logger.warning("Failed to parse timestamp for thread %d: %s", thread_id, exc)

        latest_message_content = latest_message_obj.get("message", "")
        if not latest_message_content:
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message="Latest message is empty.",
            )

        try:
            assessment = await assess_closedown(latest_message_content, settings)
        except ClosedownAgentError as exc:
            logger.warning("Closedown assessment failed for thread %d: %s", thread_id, exc)
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message=f"Closedown assessment failed: {exc}",
            )

        if assessment.closedownReadiness >= settings.autocomplete_threshold:
            await call_tool_by_patterns(
                session,
                ["create", "support_message"],
                threadId=thread_id,
                message=assessment.suggestedReply,
                creatorUserName="SupportAgent",
            )
            await call_tool_by_patterns(
                session,
                ["close", "thread"],
                threadId=thread_id,
            )
            return AutocompleteResult(
                id=thread_id,
                action="closed_resolved",
                message=assessment.suggestedReply,
            )
        else:
            return AutocompleteResult(
                id=thread_id,
                action="skipped",
                message=f"Closedown readiness below threshold ({assessment.closedownReadiness:.2f}).",
            )

    except Exception as exc:
        logger.error("Failed to process thread %d for autocomplete: %s", thread_id, exc, exc_info=True)
        return AutocompleteResult(
            id=thread_id,
            action="skipped",
            message=f"Error processing thread: {exc}",
        )
