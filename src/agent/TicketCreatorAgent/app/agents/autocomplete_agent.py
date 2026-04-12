from __future__ import annotations

import json
import logging
from dataclasses import dataclass

from langchain_openai import ChatOpenAI

from app.config import Settings
from app.prompts.autocomplete_prompt import AUTOCOMPLETE_PROMPT

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
    """Assess whether a ticket is ready to be closed.

    Args:
        latest_message: The content of the most recent message in the thread.
        settings: Application settings.

    Returns:
        A ClosedownAssessment with readiness score and suggested reply.

    Raises:
        ClosedownAgentError: If the LLM response cannot be parsed as JSON.
    """
    llm = _build_llm(settings)

    prompt_messages = AUTOCOMPLETE_PROMPT.invoke(
        {"message": latest_message}
    ).messages

    response = await llm.ainvoke(prompt_messages)
    raw_content = str(response.content).strip()

    # Remove markdown code fences if present
    if raw_content.startswith("```"):
        # Remove opening fence
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        elif raw_content.startswith("```"):
            raw_content = raw_content[3:]
        # Remove closing fence
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

    # Validate required fields
    if "closedownReadiness" not in parsed or "suggestedReply" not in parsed:
        raise ClosedownAgentError(
            f"Missing required fields in closedown assessment: {parsed}"
        )

    # Clamp readiness to [0.0, 1.0]
    readiness = float(parsed["closedownReadiness"])
    readiness = max(0.0, min(1.0, readiness))

    return ClosedownAssessment(
        closedownReadiness=readiness,
        suggestedReply=str(parsed["suggestedReply"]),
    )
