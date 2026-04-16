from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class GenerateTicketsRequest(BaseModel):
    """Request body for POST /tickets/generate."""

    tickets_count: int = Field(..., alias="ticketsCount", ge=1, le=20)
    theme: str = Field(..., min_length=1)

    @field_validator("theme")
    @classmethod
    def theme_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("theme must not be blank")
        return v


class TicketPayload(BaseModel):
    """Single ticket matching the MCP create_thread schema."""

    creator_user_name: str = Field(..., alias="creatorUserName")
    subject: str
    category: str | None = None
    message: str


class TicketResponseItem(BaseModel):
    """One ticket returned in the API response."""

    creator_user_name: str = Field(..., alias="creatorUserName")
    subject: str
    category: str | None = None
    message: str


class GenerateTicketsResponse(BaseModel):
    """Response body for POST /tickets/generate."""

    submitted: int
    tickets: list[TicketResponseItem]
