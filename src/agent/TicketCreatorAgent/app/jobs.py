from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine

from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    idle = "idle"
    active = "active"
    completed = "completed"
    error = "error"


@dataclass
class JobRecord:
    id: str
    status: JobStatus = JobStatus.idle
    start_time: datetime | None = None
    end_time: datetime | None = None
    result: Any = None
    error: str | None = None


class JobStore:
    def __init__(self) -> None:
        self._store: dict[str, JobRecord] = {}

    def create(self) -> JobRecord:
        record = JobRecord(id=str(uuid.uuid4()))
        self._store[record.id] = record
        return record

    def get(self, job_id: str) -> JobRecord | None:
        return self._store.get(job_id)

    def set_active(self, job_id: str) -> None:
        r = self._store[job_id]
        r.status = JobStatus.active
        r.start_time = datetime.now(timezone.utc)

    def set_completed(self, job_id: str, result: Any) -> None:
        r = self._store[job_id]
        r.status = JobStatus.completed
        r.end_time = datetime.now(timezone.utc)
        r.result = result

    def set_error(self, job_id: str, error: str) -> None:
        r = self._store[job_id]
        r.status = JobStatus.error
        r.end_time = datetime.now(timezone.utc)
        r.error = error


job_store = JobStore()


async def _execute(
    job_id: str,
    coro_factory: Callable[[], Coroutine[Any, Any, Any]],
) -> None:
    job_store.set_active(job_id)
    try:
        result = await coro_factory()
        if hasattr(result, "model_dump"):
            result = result.model_dump()
        job_store.set_completed(job_id, result)
    except Exception as exc:
        logger.error("Job %s failed: %s", job_id, exc, exc_info=True)
        job_store.set_error(job_id, str(exc))


async def schedule_job(
    background_tasks: BackgroundTasks,
    coro_factory: Callable[[], Coroutine[Any, Any, Any]],
) -> str:
    record = job_store.create()
    background_tasks.add_task(_execute, record.id, coro_factory)
    return record.id
