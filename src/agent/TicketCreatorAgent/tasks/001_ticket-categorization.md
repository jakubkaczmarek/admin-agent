# Task: Ticket Categorization Endpoints

## Overview

Add two new endpoints to the `TicketCreatorAgent` service that automatically assign a category to support tickets that are missing one. Both endpoints share the same single-ticket processing logic; the `/all` variant simply wraps it in a loop over every open thread.

---

## New Endpoints

### `POST /tickets/{id}/categorize`
Categorize a single ticket by its ID.

### `POST /tickets/all/categorize`
Categorize all open tickets that are missing a category, one by one.

**Request body (both endpoints, all fields optional):**

```json
{
  "allowedCategories": ["Billing", "Auth", "System", "General"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `allowedCategories` | `string[]` | ❌ | If provided, the agent must return a category from this list only. If omitted, the agent may return any suitable category name. |

**Response body — `/tickets/{id}/categorize`:**

```json
{
  "id": 1,
  "category": "System",
  "updated": true
}
```

**Response body — `/tickets/all/categorize`:**

```json
{
  "processed": 4,
  "skipped": 2,
  "results": [
    { "id": 1, "category": "System",  "updated": true },
    { "id": 3, "category": "Billing", "updated": true },
    { "id": 5, "category": null,      "updated": false, "error": "MCP tool call failed" }
  ]
}
```

> `skipped` counts tickets that already had a category and were left untouched. `updated: false` with an `error` field indicates a processing failure for that ticket.

---

## Single-Ticket Processing Logic

This logic applies to both endpoints. For `/all`, it is executed once per ticket inside a sequential loop.

```
1. [/all only] Use MCP to discover and call the "list open threads" tool
                → obtain list of thread IDs to iterate over

2. Call the MCP "get thread details" tool for the target ticket ID
   → returns: { id, category, messages: [{ id, message }, ...] }

3. If category is non-null AND non-empty:
   → skip this ticket (mark as skipped, do not call LLM or update anything)

4. If category is null or empty:
   a. Extract the content of messages[0].message (the first message)
   b. Invoke the Categorization Agent (see below) with:
      - the message content
      - the allowedCategories list (may be empty/absent)
   c. Agent returns a single category string
   d. Call the MCP "update thread" tool to set the category on the ticket
   e. Mark ticket as updated: true
```

---

## Categorization Agent

A new, dedicated LangChain agent responsible only for reading a message and returning a category name. It must be separate from the existing ticket-generation agent.

### Behaviour

- Receives the content of the first ticket message and an optional list of allowed categories
- Makes a single LLM call (no tool use required — this is a pure generation task)
- Returns a plain string: the chosen category name

### Allowed Categories Constraint

| Scenario | Agent behaviour |
|---|---|
| `allowedCategories` provided and non-empty | Must return one of the provided values exactly. Must not invent a new category. |
| `allowedCategories` empty or not provided | May return any concise, appropriate category name |

### Implementation Notes

- Use a `ChatPromptTemplate` defined in `prompts/categorize_prompt.py`
- The prompt must inject the `allowedCategories` list when present, instructing the model to treat it as an exhaustive enum
- The prompt must request a response of **only the category name** — no explanation, no punctuation, no JSON wrapper
- Parse the raw LLM string output; strip whitespace
- If `allowedCategories` is provided and the model returns a value outside the list (guard against hallucination): raise a `CategorizationError` and do not update the ticket

---

## MCP Tool Usage

The endpoint must not hardcode MCP tool names. Instead it should inspect the tools exposed by the MCP server at runtime and select the appropriate one by matching on tool description/name patterns:

| Purpose | What to look for |
|---|---|
| List all open threads | tool name/description containing `list`, `threads`, or `all` |
| Get a single thread | tool name/description containing `get`, `thread`, or `details` |
| Update a thread's category | tool name/description containing `update`, `patch`, or `category` |

### Update Thread Category Tool

The API exposes this tool via the following Node.js route:

```js
router.put('/:supportThreadId', supportThreadController.updateThreadCategory)
```

Required JSON body: { 'categoryName': 'New category name', 'userName': 'SupportAgent' }

When calling this tool, pass the ticket `id` as `supportThreadId` and include the resolved category name in the request body. This is the **only** tool that should be used to persist the category — the agent must not attempt to infer or call any other update mechanism. the 'userName' value must be hardcoded to 'SupportAgent'.

---

## New Files

```
app/
├── agents/
│   └── categorize_agent.py     # New: Categorization Agent logic
├── models/
│   └── categorize.py           # New: request/response Pydantic models
└── prompts/
    └── categorize_prompt.py    # New: prompt template for category selection
```

Routing for the two new endpoints should be added to `main.py` inside a new `APIRouter` prefixed `/tickets`.

---

## Acceptance Criteria

- `POST /tickets/{id}/categorize` returns `updated: false` (no error) when the ticket already has a category — it must not overwrite existing values
- `POST /tickets/all/categorize` continues processing remaining tickets if one fails — a single failure must not abort the loop
- When `allowedCategories` is supplied, the stored category is always one of the provided values
- No MCP tool names are hardcoded anywhere in the implementation
- The Categorization Agent is independently unit-testable (accepts message string + optional list, returns string)
