from __future__ import annotations

from pydantic import BaseModel, Field


class AnalyzerOutput(BaseModel):
    should_reply: bool = Field(
        description="False if the last message was posted by SupportAgent — skip the rest of the flow."
    )
    analysis: str = Field(
        description="Brief explanation of the thread state and why a reply is or is not needed."
    )
    proposed_reply: str = Field(
        description="Draft reply to the user. Empty string when should_reply is false."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score for the proposed reply (0.0–1.0).",
    )
