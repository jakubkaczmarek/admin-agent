# API Changes — Background Job System

All three action endpoints now return immediately with a job ID instead of blocking until completion. Use `GET /jobs/{id}` to poll for the result.

## Changed Endpoints

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /tickets/generate` | `201` full result | `202` job accepted |
| `POST /tickets/all/autocomplete` | `200` full result | `202` job accepted |
| `POST /tickets/all/categorize` | `200` full result | `202` job accepted |

### New response for all three (202)
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "idle"
}
```

---

## New Endpoint — `GET /jobs/{jobId}`

Poll this to get job status and, once complete, the full result payload.

### Response
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "idle | active | completed | error",
  "startTime": "2026-04-16T10:00:00Z",
  "endTime": "2026-04-16T10:00:05Z",
  "executionTime": 5.123,
  "result": { ... },
  "error": null
}
```

- `startTime` / `endTime` / `executionTime` / `result` / `error` are `null` until relevant
- `result` contains the same payload the endpoint previously returned synchronously
- Returns `404` if the job ID is unknown: `{ "detail": "Job 'x' not found." }`

### Status lifecycle
```
idle → active → completed
                ↘ error
```

---

## Polling Pattern

```js
const { jobId } = await post('/tickets/generate', body);

let job;
do {
  await sleep(1000);
  job = await get(`/jobs/${jobId}`);
} while (job.status === 'idle' || job.status === 'active');

if (job.status === 'completed') use(job.result);
if (job.status === 'error')     showError(job.error);
```
