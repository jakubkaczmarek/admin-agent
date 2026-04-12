# ARCHITECTURE.md

## System Architecture

### High-Level Request Flow

```
Client
  │
  │  POST /tickets/generate  { ticketsCount: 5, theme: "General system failures" }
  ▼
┌──────────────────────────────────────┐
│           FastAPI Handler             │
│  • Validates request (Pydantic)       │
│  • Enforces ticketsCount 1–20 range   │
│  • Delegates to ticket agent          │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│          LangChain Agent              │
│  (tool-calling agent / AgentExecutor) │
└───────┬──────────────────────────────┘
        │
        │  Step 1 — single LLM call
        ▼
┌───────────────────────┐
│     OpenAI API        │
│  (GPT-4o)             │
│                       │
│  Prompt:              │
│  "Generate 5 distinct │
│  tickets on theme X   │
│  as a JSON array"     │
│                       │
│  Returns: JSON array  │
│  of 5 ticket objects  │
└───────┬───────────────┘
        │
        │  Step 2 — one MCP tool call per ticket (loop)
        ▼
┌───────────────────────┐
│   MCP Client          │
│  (langchain-mcp-      │
│   adapters)           │
└───────┬───────────────┘
        │  calls create_thread x5
        ▼
┌───────────────────────┐
│   MCP Server          │
│  (3rd-party hosted)   │
│                       │
│  Tool: create_thread  │
│  { creatorUserName,   │
│    subject,           │
│    category?,         │
│    message }          │
└───────┬───────────────┘
        │
        ▼
  Ticketing System
  (Zendesk / Jira / etc.)

        │
        │  Step 3 — collected results returned up the chain
        ▼
┌──────────────────────────────────────┐
│           FastAPI Handler             │
│  Returns: { submitted: 5, tickets[] } │
└──────────────────────────────────────┘
```

---

## Two-Phase Agent Execution

The agent execution is deliberately split into two distinct phases:

**Phase 1 — Bulk generation (1 LLM call)**

The agent prompts ChatGPT once to produce all `N` tickets as a JSON array. This is cheaper and faster than calling the LLM once per ticket. The prompt instructs the model to:
- Return only valid JSON (no markdown fences, no preamble)
- Produce `ticketsCount` unique ticket objects
- Vary usernames, tone, category presence, and problem descriptions
- Stay within the provided theme

**Phase 2 — Sequential MCP submission (N tool calls)**

The agent parses the JSON array and iterates, calling `create_thread` once per ticket. Calls are made sequentially (not concurrently) to avoid overwhelming the MCP server. If a single call fails, the error is logged, the ticket is skipped, and iteration continues — partial success is acceptable and reported in the response.

---

## Component Responsibilities

### `main.py` — API Layer
- Defines the FastAPI app and the `POST /tickets/generate` route
- Handles HTTP concerns only: parsing, validation, status codes, error responses
- Delegates all business logic to the agent layer
- No LangChain or MCP code lives here

### `config.py` — Configuration
- Single `Settings` class using `pydantic-settings`
- Reads from environment variables / `.env` file
- Instantiated once at startup as a module-level singleton
- All other modules import `settings` from here — never read `os.environ` directly

### `agents/ticket_agent.py` — Agent Layer
- Owns the full LangChain agent lifecycle for a single request
- Opens an MCP client session, fetches tools, runs the two-phase execution, closes the session
- Returns a structured `list[TicketPayload]` (generated tickets) and a `list[str]` (MCP results) to the handler
- Must be stateless — no shared mutable state between requests

### `models/ticket.py` — Data Models
- `GenerateTicketsRequest` — incoming POST body (`ticketsCount`, `theme`)
- `TicketPayload` — one ticket matching the MCP `create_thread` schema (`creatorUserName`, `subject`, `category?`, `message`)
- `GenerateTicketsResponse` — outgoing response (`submitted`, `tickets`)
- No logic, only field definitions and validators

### `prompts/ticket_prompt.py` — Prompts
- All prompt templates defined here as `ChatPromptTemplate` instances
- Includes the system prompt for batch ticket generation
- The generation prompt must specify JSON-only output and all diversity constraints

---

## MCP Integration

The MCP client (`MultiServerMCPClient`) is initialised **per request** inside an async context manager:

```python
async with MultiServerMCPClient({
    "ticketing": {
        "url": settings.mcp_server_url,
        "transport": "streamable_http",
    }
}) as client:
    tools = client.get_tools()
    # run agent
```

If the MCP server requires authentication, add headers:

```python
"headers": { "Authorization": f"Bearer {settings.mcp_api_key}" }
```

---

## Error Handling Strategy

| Failure point | Behaviour |
|---|---|
| Invalid request payload | FastAPI + Pydantic raises `422 Unprocessable Entity` automatically |
| `ticketsCount` out of range (< 1 or > 20) | Pydantic validator raises `422` |
| LLM returns malformed JSON | Parse error is caught; raise `502` with message |
| OpenAI API error | Catch `openai.OpenAIError`; return `502 Bad Gateway` |
| MCP connection failure | Catch at session open; return `503 Service Unavailable` |
| Single `create_thread` call fails | Log warning, skip ticket, continue loop; report in response |
| All MCP calls fail | Return `502` with details |

---

## Scalability Considerations

- The app is **stateless** — safe to run multiple replicas behind a load balancer
- LLM call (Phase 1) is the primary latency bottleneck (~1–3 s for batch generation)
- MCP calls (Phase 2) are sequential by design; for large batches consider `asyncio.gather` with a semaphore to cap concurrency
- For very high throughput, decouple via a task queue (Celery + Redis) and return a job ID immediately
