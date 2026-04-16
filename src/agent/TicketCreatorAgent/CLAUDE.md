# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Environment setup
cp .env.example .env   # then fill in real values
```

No test suite exists yet. OpenAPI docs are served at `/docs` when the server is running.

## Architecture

FastAPI app (`app/main.py`) exposing three independent feature areas, each following the same layered pattern:

```
app/
├── main.py                          # All FastAPI routes and request orchestration
├── config.py                        # Pydantic-settings singleton (import `settings`)
├── mcp.py                           # MCP session management and tool discovery
└── langchain/
    ├── agents/                      # Business logic — LLM calls and MCP interactions
    ├── models/                      # Pydantic request/response models
    └── prompts/                     # ChatPromptTemplate definitions
```

### Three feature areas

**Ticket Generation** (`POST /tickets/generate`) — two-phase pipeline:
1. Single LLM call produces all N tickets as a JSON array (`ticket_agent.py`)
2. Sequential MCP `create_support_thread` calls, one per ticket — partial success is acceptable

**Categorization** (`POST /tickets/all/categorize`) — for every open thread missing a category, the LLM picks one (from an optional allowed-list) and the category is written back via MCP (`categorize_agent.py`)

**Autocomplete** (`POST /tickets/all/autocomplete`) — for each open thread, checks if the last message is user-authored, whether it is >7 days old (auto-close for inactivity), then asks the LLM for a `closedownReadiness` score (0–1). Threads at or above `AUTOCOMPLETE_THRESHOLD` (default `0.90`) get a suggested reply posted and are closed (`autocomplete_agent.py`)

### MCP session rules

`app/mcp.py` provides two key primitives:

- `mcp_session(settings)` — async context manager; always open **one session per request** and reuse it for all tool calls. Opening a new session per tool call causes `ExceptionGroup` errors.
- `call_tool_by_patterns(session, patterns, **kwargs)` — discovers tools by AND-matching substrings against tool name + description. Never hardcode tool names; always use pattern lists (e.g. `["create", "support_thread"]`).

### Configuration

All settings live in `app/config.py` via `pydantic-settings`. Never read `os.environ` directly elsewhere. Required env vars: `OPENAI_API_KEY`, `MCP_SERVER_URL`. See `.env.example` for all options including `AUTOCOMPLETE_THRESHOLD` and `CORS_ORIGINS`.
