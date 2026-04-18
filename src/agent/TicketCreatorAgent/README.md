# Ticket Creator Agent

A Python-based HTTP API that exposes endpoints for managing support tickets. It uses OpenAI to generate and process tickets via LangChain agents, and CrewAI for intelligent autoreply with a knowledge base.

## Features

- Bulk ticket generation with a single LLM call
- Ticket categorization for uncategorized open threads
- Autocomplete: auto-close inactive or resolved threads
- Autoreply: CrewAI crew drafts and sends replies using a knowledge base
- All long-running operations run as background jobs (poll via `/jobs/{id}`)
- Configurable OpenAI model and MCP server settings
- OpenAPI documentation at `/docs`
- Stateless design — safe to run multiple replicas

## Prerequisites

- Python 3.11+
- OpenAI API key
- Access to an MCP server with `create_support_thread`, `create_support_message`, and related tools

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your actual values:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   OPENAI_MODEL=gpt-4o
   MCP_SERVER_URL=http://localhost:8000/mcp
   MCP_TRANSPORT=streamable_http
   AUTOCOMPLETE_THRESHOLD=0.90
   CORS_ORIGINS=http://localhost:3000
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## API Reference

All mutating endpoints return `202 Accepted` with a `jobId`. Poll `GET /jobs/{jobId}` for the result.

### GET `/jobs/{jobId}`

Poll the status and result of a background job.

### POST `/tickets/generate`

Generate and submit a batch of support tickets.

**Request:**
```json
{ "ticketsCount": 5, "theme": "General system failures" }
```

**Job result:**
```json
{
  "submitted": 5,
  "tickets": [
    {
      "creatorUserName": "Alice",
      "subject": "Cannot log in after password reset",
      "category": "Auth",
      "message": "Since resetting my password yesterday I am unable to log in..."
    }
  ]
}
```

### POST `/tickets/all/categorize`

For every open thread missing a category, the LLM picks one and writes it back via MCP.

**Request:**
```json
{ "allowedCategories": ["Auth", "Billing", "Hardware"] }
```

**Job result:**
```json
{ "processed": 3, "skipped": 2, "results": [...] }
```

### POST `/tickets/all/autocomplete`

For each open thread, checks inactivity (>7 days) or closedown readiness score ≥ `AUTOCOMPLETE_THRESHOLD`. Qualifying threads get a suggested reply posted and are closed.

**Job result:**
```json
{ "processed": 4, "results": [...] }
```

### POST `/tickets/all/autoreply`

For every open thread, runs a CrewAI crew that fetches the thread, searches the knowledge base, drafts a reply, and sends it if needed. Threads whose last message is from `SupportAgent` are skipped.

**Job result:**
```json
{
  "processed": 3,
  "skipped": 2,
  "results": [
    {
      "id": 42,
      "action": "replied",
      "analysis": "User is asking about password reset policy.",
      "message": "Hi Alice, you can reset your password via..."
    }
  ]
}
```

`action` is one of `replied`, `skipped`, or `error`.

### GET `/health`

```json
{ "status": "ok" }
```

## Project Structure

```
app/
├── main.py                              # FastAPI app, all route definitions
├── config.py                            # Pydantic settings (loaded from .env)
├── mcp.py                               # MCP session management and tool discovery
├── jobs.py                              # Background job store and scheduler
├── support_threads_orchestrator.py      # Fetches all open threads, runs per-thread fn
├── langchain/
│   ├── agents/
│   │   ├── ticket_agent.py              # Bulk ticket generation
│   │   ├── categorize_agent.py          # Per-thread categorization
│   │   └── autocomplete_agent.py        # Per-thread autocomplete/close logic
│   ├── models/                          # Pydantic request/response models
│   └── prompts/                         # ChatPromptTemplate definitions
└── crewai/
    ├── support_thread_reply_crew.py     # CrewAI crew: fetch → analyze → write → send
    ├── agents/                          # Agent role/goal/backstory YAML configs
    │   ├── fetcher_analyzer.yaml
    │   ├── response_writer.yaml
    │   └── sender.yaml
    ├── tools/                           # CrewAI tool definitions (YAML + implementations)
    │   ├── get_support_thread.yaml
    │   ├── create_support_message.yaml
    │   └── kb_search.yaml
    ├── models/
    │   └── analyzer_output.py           # Structured output from the analyzer agent
    └── documents/                       # Knowledge base documents (txt files per category)
        ├── Accounts_and_Access.txt
        ├── Cloud_Services.txt
        ├── Hardware.txt
        └── ...
```

## Architecture

### LangChain agents (ticket generation, categorization, autocomplete)

Each follows the same pattern: one LLM call per thread via LangChain, interacting with MCP via `mcp_session` + `call_tool_by_patterns`.

**Ticket Generation** — two-phase pipeline:
1. Single LLM call produces all N tickets as a JSON array
2. Sequential MCP `create_support_thread` calls, one per ticket — partial success is acceptable

**Categorization** — for every open thread missing a category, the LLM picks one (from an optional allowed-list) and writes it back via MCP.

**Autocomplete** — checks if the last message is user-authored, whether it is >7 days old (auto-close for inactivity), then asks the LLM for a `closedownReadiness` score (0–1). Threads at or above `AUTOCOMPLETE_THRESHOLD` get a reply posted and are closed.

### CrewAI autoreply crew

`app/crewai/support_thread_reply_crew.py` runs a sequential three-agent crew per thread:

1. **FetcherAnalyzer** — fetches the thread via MCP, searches the knowledge base (`kb_search`), and outputs a structured JSON decision (`should_reply`, `analysis`, `proposed_reply`, `confidence`)
2. **ResponseWriter** — polishes the proposed reply into a warm, professional message (outputs `NO_REPLY_NEEDED` if `should_reply` is false)
3. **Sender** — calls `create_support_message` via MCP if a reply is needed; otherwise outputs `SKIPPED`

The knowledge base (`app/crewai/documents/`) contains plain-text policy documents across categories (Accounts, Hardware, Billing, etc.) that the FetcherAnalyzer searches to ground its replies.

### MCP session rules

`app/mcp.py` provides two key primitives:

- `mcp_session(settings)` — async context manager; always open **one session per request** and reuse it for all tool calls
- `call_tool_by_patterns(session, patterns, **kwargs)` — discovers tools by AND-matching substrings against tool name + description

### Background jobs

All endpoints return `202` immediately with a `jobId`. The job runs in a FastAPI `BackgroundTasks` worker. Poll `GET /jobs/{jobId}` for `status` (`idle`, `running`, `done`, `error`) and the final `result`.

## Error Handling

| Failure | Response |
|---|---|
| Invalid request | 422 Unprocessable Entity |
| LLM returns malformed JSON | 502 Bad Gateway |
| OpenAI API error | 502 Bad Gateway |
| MCP connection failure | 503 Service Unavailable |
| Single per-thread failure | Logged, action set to `error`, continues loop |
