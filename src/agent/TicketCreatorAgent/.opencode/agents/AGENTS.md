# AGENTS.md

## Project Overview

This project is a **Python-based HTTP API** that exposes a POST endpoint for bulk-creating support tickets in a 3rd-party ticketing system. When called, the endpoint:

1. Accepts two parameters: a **count** of tickets to create and a **theme** describing the general topic
2. Uses **ChatGPT (OpenAI API)** to generate `N` distinct, realistic tickets — each with a unique fictional creator, subject, message, and optionally a category
3. Submits each generated ticket to the ticketing system by calling the MCP server's `create_thread` tool once per ticket

The goal is a clean, minimal, production-ready service that is easy to extend (e.g. multiple ticket types, multiple MCP servers, different LLM backends).

---

## POST Endpoint

### `POST /tickets/generate`

**Request body:**

```json
{
  "ticketsCount": 5,
  "theme": "General system failures"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `ticketsCount` | `int` | ✅ | Number of tickets to generate and submit. Min: 1, Max: 20. |
| `theme` | `str` | ✅ | The topic/theme for all generated tickets (e.g. `"General system failures"`, `"Login issues"`) |

**Response body:**

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

---

## MCP Server — `create_thread` Tool

The MCP server exposes a tool that creates a new support thread. The agent must call this tool **once per ticket**. Payload schema:

```json
{
  "creatorUserName": "Adam",
  "subject": "Data import doesn't work",
  "category": "System",
  "message": "I tried importing CSV data this morning, but it didn't work"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `creatorUserName` | `string` | ✅ | Name of the fictional user reporting the issue |
| `subject` | `string` | ✅ | Short, descriptive ticket subject line |
| `category` | `string` | ❌ | Optional category tag (e.g. `"System"`, `"Auth"`, `"Billing"`). Vary — some tickets include it, some do not |
| `message` | `string` | ✅ | Full description of the issue as written by the user |

---

## LLM Generation Behaviour

ChatGPT is responsible for generating the full batch of `ticketsCount` tickets in a **single LLM call** before any MCP tool calls are made. The LLM output must be a JSON array of ticket objects conforming to the `create_thread` schema above. The agent then iterates over the array and calls the MCP tool once per ticket.

**Diversity requirements the prompt must enforce:**

- Each `creatorUserName` must be unique and realistic (varied first names)
- Each ticket must describe a distinct problem related to the theme
- `category` should be present on roughly half the tickets and absent on the others
- Tone and length should vary: some users are frustrated, some polite, some brief, some detailed

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Web framework | **FastAPI** | Async HTTP API, request validation, OpenAPI docs |
| LLM integration | **LangChain** + `langchain-openai` | Orchestrates ChatGPT calls for batch ticket generation |
| MCP client | **langchain-mcp-adapters** | Connects to the ticketing MCP server, exposes `create_thread` tool to the agent |
| LLM provider | **OpenAI API** (GPT-4o) | Generates ticket content; key supplied via config |
| Config management | **pydantic-settings** | Typed, validated settings loaded from `.env` |
| Runtime | **Python 3.11+** | Minimum version required |
| Server | **Uvicorn** | ASGI server for running FastAPI |

---

## Key Dependencies

```
fastapi
uvicorn[standard]
langchain
langchain-openai
langchain-mcp-adapters
pydantic-settings
python-dotenv
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (`sk-...`) |
| `OPENAI_MODEL` | Model to use (default: `gpt-4o`) |
| `MCP_SERVER_URL` | URL of the ticketing MCP server |
| `MCP_TRANSPORT` | Transport protocol: `streamable_http`, `sse`, or `stdio` (default: `streamable_http`) |

---

## Agent Behaviour

The LangChain agent is a **tool-calling agent** (`create_tool_calling_agent`). On each request it:

1. Receives a prompt instructing it to generate `ticketsCount` varied tickets on the given `theme`
2. Makes **one LLM call** to produce the full batch as a structured JSON array
3. Iterates over the array and calls the MCP `create_thread` tool **once per ticket**
4. Collects all results and returns a summary to the API handler

Tool discovery is **automatic** — the agent uses whatever tools the MCP server exposes at runtime. No tool names are hardcoded.

---

## Project Structure

```
app/
├── main.py                  # FastAPI app entry point, route definitions
├── config.py                # Pydantic settings (loaded from .env)
├── agents/
│   └── ticket_agent.py      # LangChain agent setup and execution logic
├── models/
│   └── ticket.py            # Pydantic request/response models
└── prompts/
    └── ticket_prompt.py     # Prompt templates for ticket generation
.env.example
requirements.txt
README.md
```
