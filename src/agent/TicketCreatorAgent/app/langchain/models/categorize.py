from __future__ import annotations

from pydantic import BaseModel, Field


class CategorizeRequest(BaseModel):
    """Request body for categorization endpoints."""

    allowed_categories: list[str] | None = Field(
        default=None,
        alias="allowedCategories",
        description="If provided, the agent must return a category from this list only.",
    )


class CategorizeResult(BaseModel):
    """Result for a single ticket categorization."""

    id: int
    category: str | None = None
    updated: bool = False
    error: str | None = None


class CategorizeAllResponse(BaseModel):
    """Response body for POST /tickets/all/categorize."""

    processed: int
    skipped: int
    results: list[CategorizeResult]
