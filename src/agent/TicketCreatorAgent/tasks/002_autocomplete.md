# Task 3: Auto-Complete Endpoint

## Overview

Add a new endpoint that scans all open tickets and automatically closes those that are clearly resolved or have gone inactive — without any human intervention.

---

## New Endpoint

### `POST /tickets/all/autocomplete`

No request body required.

**Response body:**

```json
{
  "processed": 8,
  "results": [
    { "id": 1, "action": "closed_inactive",  "message": "Closed due to inactivity." },
    { "id": 2, "action": "closed_resolved",  "message": "Glad we resolved your case." },
    { "id": 3, "action": "skipped",          "message": "Last message is from SupportAgent." },
    { "id": 4, "action": "skipped",          "message": "Closedown readiness below threshold (0.43)." }
  ]
}
```

Possible `action` values: `closed_inactive` | `closed_resolved` | `skipped`.

---

## Processing Logic

```
1. Discover and call the MCP "list open threads" tool
   → get list of all open thread IDs

2. For each thread ID, repeat the following:

   a. Discover and call the MCP "get thread details" tool
      → returns: { id, category, messages: [{ id, creatorUserName, message, createdAt }, ...] }

   b. Check the latest message (messages[last]).creatorUserName:
      → if "SupportAgent": skip entirely (action: "skipped")

   c. Check the latest message timestamp (messages[last].createdAt):
      → if older than 7 days:
           - call MCP "add message" tool with hardcoded content:
             "The thread has been automatically closed due to inactivity."
             (creatorUserName: "SupportAgent")
           - call MCP "close thread" tool
           - action: "closed_inactive"
           - continue to next ticket (do not run LLM step)

   d. Pass the latest message content to the Closedown Agent (see below)
      → agent returns: { closedownReadiness: float, suggestedReply: string }

   e. If closedownReadiness >= AUTOCOMPLETE_THRESHOLD (from .env):
        - call MCP "add message" tool with suggestedReply as content
          (creatorUserName: "SupportAgent")
        - call MCP "close thread" tool
        - action: "closed_resolved"

   f. If closedownReadiness < AUTOCOMPLETE_THRESHOLD:
        - skip (action: "skipped", include readiness score in message)
```

---

## New Environment Variable

| Variable | Description | Example |
|---|---|---|
| `AUTOCOMPLETE_THRESHOLD` | Minimum closedown readiness score (0.0–1.0) to trigger auto-close | `0.90` |

Add to `config.py` as a `float` field with a default of `0.90`.

---

## Closedown Agent

A new, dedicated LangChain agent that reads the latest message in a thread and estimates how ready the ticket is to be closed.

### Input

| Input | Description |
|---|---|
| `latest_message` | The content of the most recent message in the thread (`string`) |

### Output

The agent must return a structured object:

```python
@dataclass
class ClosedownAssessment:
    closedownReadiness: float   # 0.0 (not ready) → 1.0 (ready to close)
    suggestedReply: str         # closing message to post before closing the thread
```

### Scoring Guide (must be reflected in the prompt)

| Signal in latest message | Expected `closedownReadiness` range |
|---|---|
| User explicitly says "thank you", "resolved", "you can close this" | 0.90 – 1.00 |
| User implies satisfaction ("that worked", "all good now") | 0.70 – 0.90 |
| Ambiguous or neutral tone | 0.30 – 0.70 |
| User still has an open question or expresses frustration | 0.00 – 0.30 |

### Implementation Notes

- The agent makes a single LLM call — no tool use, no RAG required
- The prompt must request a **JSON-only** response with no preamble or markdown fences
- Parse the raw response as JSON; if parsing fails, raise `ClosedownAgentError` and skip the ticket
- `suggestedReply` should be a short, warm, professional closing message appropriate to the thread context
- Define the prompt in `prompts/autocomplete_prompt.py`

---

## MCP Tool Usage

Do not hardcode MCP tool names. Discover at runtime and match by description/name:

| Purpose | Pattern to match |
|---|---|
| List all open threads | `list`, `threads`, `all` |
| Get thread details | `get`, `thread`, `details` |
| Add a message to a thread | `add`, `message`, `reply`, `contribute` |
| Close a thread | `close`, `thread` |

---

## New Files

```
app/
├── agents/
│   └── autocomplete_agent.py   # Closedown Agent logic and ClosedownAssessment dataclass
└── prompts/
    └── autocomplete_prompt.py  # Prompt template for closedown scoring
```

Route handler goes in `main.py` under the existing `/tickets` router.

---

## Acceptance Criteria

- Tickets whose latest message author is `SupportAgent` are always skipped — no MCP writes are made
- Inactive tickets (last message > 7 days old) are closed with the hardcoded inactivity message without invoking the LLM
- The closedown readiness threshold is read from `AUTOCOMPLETE_THRESHOLD` in `.env`; changing it requires no code change
- `closedownReadiness` is always a float between 0.0 and 1.0; values outside this range from the LLM must be clamped before comparison
- Every posted message has `creatorUserName` set to `"SupportAgent"` exactly
- A JSON parse failure from the Closedown Agent results in a skip, not a crash
- The `/all` endpoint continues processing remaining tickets if one fails
