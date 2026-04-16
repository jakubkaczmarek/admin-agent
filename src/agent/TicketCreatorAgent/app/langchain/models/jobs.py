from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class JobAcceptedResponse(BaseModel):
    job_id: str = Field(..., alias="jobId")
    status: str

    model_config = {"populate_by_name": True}


class JobResponse(BaseModel):
    job_id: str = Field(..., alias="jobId")
    status: str
    start_time: datetime | None = Field(default=None, alias="startTime")
    end_time: datetime | None = Field(default=None, alias="endTime")
    execution_time: float | None = Field(default=None, alias="executionTime")
    result: Any = None
    error: str | None = None

    model_config = {"populate_by_name": True}
