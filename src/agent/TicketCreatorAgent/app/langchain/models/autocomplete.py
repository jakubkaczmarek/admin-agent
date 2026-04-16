from __future__ import annotations

from pydantic import BaseModel


class AutocompleteResult(BaseModel):
    """Result for a single ticket auto-completion."""

    id: int
    action: str  # "closed_inactive", "closed_resolved", or "skipped"
    message: str


class AutocompleteResponse(BaseModel):
    """Response body for POST /tickets/all/autocomplete."""

    processed: int
    results: list[AutocompleteResult]
