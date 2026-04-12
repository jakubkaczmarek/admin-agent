# Ticket Creator Agent

A Python-based HTTP API that exposes a POST endpoint for bulk-creating support tickets in a 3rd-party ticketing system. It uses ChatGPT (OpenAI API) to generate distinct, realistic tickets and submits each to the ticketing system via an MCP server's `create_thread` tool.

## Features

- Bulk ticket generation with a single LLM call
- Sequential MCP submission with per-ticket error handling
- Configurable OpenAI model and MCP server settings
- OpenAPI documentation at `/docs`
- Stateless design — safe to run multiple replicas

## Prerequisites

- Python 3.11+
- OpenAI API key
- Access to an MCP server with `create_thread` tool

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
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## API Reference

### POST `/tickets/generate`

Generate and submit a batch of support tickets.

**Request:**
```json
{
  "ticketsCount": 5,
  "theme": "General system failures"
}
```

**Response:**
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

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

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
```

## Architecture

The service uses a two-phase agent execution:

1. **Phase 1 — Bulk generation (1 LLM call):** Prompts ChatGPT once to produce all `N` tickets as a JSON array
2. **Phase 2 — Sequential MCP submission (N tool calls):** Iterates over the array, calling `create_thread` once per ticket

## Error Handling

| Failure | Response |
|---|---|
| Invalid request | 422 Unprocessable Entity |
| LLM returns malformed JSON | 502 Bad Gateway |
| OpenAI API error | 502 Bad Gateway |
| MCP connection failure | 503 Service Unavailable |
| Single create_thread call fails | Logged, skipped, continues loop |
