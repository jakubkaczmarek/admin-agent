# Task 2: Auto-Reply Endpoints

## Prerequisites

**Task 1 (RAG Infrastructure) must be completed first.** The autoreply agent depends on the RAG pipeline to determine whether a problem is in scope and to retrieve accurate reply content from system documentation.

---

## Overview

Add two endpoints that automatically process open support tickets and decide — using an LLM grounded in RAG documents — whether to reply autonomously, escalate to a human, or close the ticket as out of scope.

---

## New Endpoints

### `POST /tickets/{id}/autoreply`
Process a single ticket by ID.

### `POST /tickets/all/autoreply`
Process all open tickets sequentially; apply the same logic to each.

No request body required for either endpoint.

**Response body — `/tickets/{id}/autoreply`:**

```json
{
  "id": 1,
  "action": "replied" | "escalated" | "closed_out_of_scope" | "skipped",
  "message": "Replied with instructions for CSV import."
}
```

**Response body — `/tickets/all/autoreply`:**

```json
{
  "processed": 6,
  "results": [
    { "id": 1, "action": "replied",             "message": "..." },
    { "id": 2, "action": "skipped",             "message": "Last message is from SupportAgent" },
    { "id": 3, "action": "escalated",           "message": "..." },
    { "id": 4, "action": "closed_out_of_scope", "message": "..." }
  ]
}
```

---

## Single-Ticket Processing Logic

```
1. [/all only] Discover and call the MCP "list open threads" tool
               → get list of thread IDs to iterate over

2. Discover and call the MCP "get thread details" tool for the target ID
   → returns: { id, category, messages: [{ id, creatorUserName, message }, ...] }

3. Check the latest message (messages[last]).creatorUserName:
   → if "SupportAgent": skip this ticket entirely (action: "skipped")

4. Check total message count:
   → if messages.length > 5: trigger "human on the loop" scenario (see below)

5. Collect all messages and pass them to the AutoReply Agent (see below)
   The agent decides one of three outcomes:

   a. OUT OF SCOPE
      → call MCP "add message" tool with short justification
        (creatorUserName: "SupportAgent")
      → call MCP "close thread" tool
      → action: "closed_out_of_scope"

   b. IN SCOPE — NO CLEAR ANSWER
      → call MCP "add message" tool explaining it is likely in scope
        and that a human agent will follow up
        (creatorUserName: "SupportAgent")
      → action: "escalated"

   c. IN SCOPE — CLEAR ANSWER AVAILABLE
      → call MCP "add message" tool with the full reply content
        (creatorUserName: "SupportAgent")
      → action: "replied"
```

### Human-on-the-Loop Scenario (> 5 messages)

Bypass the LLM decision entirely. Call MCP "add message" tool with:
- `creatorUserName`: `"SupportAgent"`
- `message`: a hardcoded note explaining the thread has been redirected to a human agent due to length

Then set `action: "escalated"`. Do not close the thread.

---

## AutoReply Agent

A new LangChain agent dedicated to analysing a full thread and deciding the correct action. It uses **RAG** to ground its decision in system documentation.

### Inputs

| Input | Description |
|---|---|
| `messages` | Full list of thread messages (all of `{ id, creatorUserName, message }`) |
| `retriever` | RAG retriever from `app.rag.retriever.get_retriever()` |

### Decision Logic

The agent must query the RAG retriever with a summary of the problem described in the messages, then reason over the retrieved document chunks to produce one of three outcomes:

| Outcome | Condition |
|---|---|
| `out_of_scope` | Problem is clearly unrelated to anything in the RAG documents |
| `escalate` | Problem appears in scope but no confident, specific answer is available |
| `reply` | A clear, accurate answer can be constructed from the RAG documents |

### Output

The agent returns a structured object:

```python
@dataclass
class AutoReplyDecision:
    outcome: Literal["out_of_scope", "escalate", "reply"]
    message: str  # the text to post as a new thread message
```

### Implementation Notes

- Use `RetrievalQA` or a custom `ChatPromptTemplate` that injects retrieved RAG chunks alongside the thread messages
- The system prompt must instruct the model to only use information from the retrieved documents — it must not invent system-specific facts from general knowledge
- The agent must return structured output (use LangChain's `.with_structured_output()` or parse a JSON-only response)
- Define the prompt in `prompts/autoreply_prompt.py`

---

## MCP Tool Usage

Do not hardcode MCP tool names. Discover tools at runtime and match by name/description:

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
│   └── autoreply_agent.py      # AutoReply Agent logic and decision dataclass
└── prompts/
    └── autoreply_prompt.py     # Prompt template for the autoreply decision
```

Route handlers go in `main.py` under the existing `/tickets` router.

---

## Acceptance Criteria

- Tickets whose latest message is from `SupportAgent` are always skipped — no MCP writes are made
- Threads with more than 5 messages always trigger the human escalation path, regardless of LLM output
- Every message posted by the agent has `creatorUserName` set to `"SupportAgent"` exactly
- The agent's reply content is always grounded in RAG documents — it must not fabricate system-specific information
- `/all` endpoint continues processing if a single ticket fails
- All three outcome paths (out of scope, escalate, reply) result in a new MCP message being posted
- Only "out of scope" closes the thread; all other outcomes leave it open
