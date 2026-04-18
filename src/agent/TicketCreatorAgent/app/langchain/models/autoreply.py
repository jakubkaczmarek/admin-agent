from __future__ import annotations

from pydantic import BaseModel


class AutoreplyResult(BaseModel):
    id: int
    action: str  # "replied" | "skipped" | "error"
    analysis: str
    message: str  # sent reply text, skip reason, or error description


class AutoreplyResponse(BaseModel):
    processed: int
    skipped: int
    results: list[AutoreplyResult]
