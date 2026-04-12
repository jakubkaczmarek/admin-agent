# MCP Server — Support Tickets

## Connection

| Property | Value |
|---|---|
| Transport | `streamable_http` |
| URL | Configured via `MCP_SERVER_URL` env var (default: `http://localhost:3000/mcp`) |
| Session management | One session per request batch — open once, reuse for all tool calls, close when done |
| Entity IDs | **Strings** (GUID-like, e.g. `lc_e9a2a7d8-5ab6-4d26-9253-51892fb0eadc`). The MCP layer wraps the underlying API's integer IDs — agents always work with the MCP-assigned string IDs. |

**Critical:** Always open a single MCP session for the entire request lifecycle. Opening a new session per tool call causes connection instability (`ExceptionGroup: unhandled errors in a TaskGroup`). Use the shared `mcp_session(settings)` context manager from `app/mcp.py`.

---

## Exposed Tools

The server exposes five tools. All entity IDs are **strings** (MCP-assigned GUIDs that wrap the underlying API's integer IDs).

| Tool name | Description | Purpose |
|---|---|---|
| `create_support_thread` | Create a new support thread with an initial message | Submit new tickets |
| `create_support_message` | Add a new message to an existing support thread | Reply to tickets |
| `close_support_thread` | Close a support thread (change status to closed) | Resolve tickets |
| `get_support_threads` | Get a paginated list of support threads with optional status filter | List/search tickets |
| `get_support_thread_by_id` | Get a full support thread with all its messages | Fetch single ticket details |

---

## Tool Schemas

### `create_support_thread`

Creates a new thread. All required fields.

```json
{
  "creatorUserName": "string    // required
  "subject": "string",          // required
  "message": "string",          // required
  "category": "string?"         // optional
}
```

### `create_support_message`

Adds a reply to an existing thread.

```json
{
  "supportThreadId": "string",    // required — the MCP-assigned thread ID
  "userName": "string",           // required
  "message": "string"             // required
}
```

### `close_support_thread`

Closes a thread by ID.

```json
{
  "supportThreadId": "string"    // required — the MCP-assigned thread ID
}
```

### `get_support_threads`

Lists threads with optional status filter. Returns a **paginated** response.

**Input:**
```json
{
  "status": "open | closed | null"   // optional filter
}
```

**Output** (paginated structure):
```json
{
  "data": [                          // array of thread objects
    {
      "id": "string",                // MCP-assigned GUID
      "category": "string?",
      "status": "open | closed",
      "messages": [
        { "id": "integer", "message": "string", ... }
      ],
      ...
    }
  ],
  "total": "integer",
  "page": "integer",
  "totalPages": "integer"
}
```

### `get_support_thread_by_id`

Fetches a single thread with all its messages.

**Input:**
```json
{
  "supportThreadId": "string"    // required — the MCP-assigned thread ID
}
```

**Output:**
```json
{
  "id": "string",
  "category": "string?",
  "status": "open | closed",
  "messages": [
    { "id": "integer", "message": "string", ... }
  ],
  ...
}
```

---

## Tool Discovery

**Never hardcode tool names** in agent code. Use the pattern-based discovery mechanism from `app/mcp.py`:

```python
from app.mcp import call_tool_by_patterns, find_tool, list_tools

# One-call convenience:
result = await call_tool_by_patterns(session, ["get", "support_thread_by_id"], supportThreadId=42)

# Or manual find + invoke:
tools = await list_tools(session)
tool = find_tool(tools, ["create", "support_thread"])
if tool:
    await tool.ainvoke(payload)
```

The `find_tool` function uses **AND logic** — all patterns must match against the tool's name + description (case-insensitive).

### Common pattern combinations

| Purpose | Patterns |
|---|---|
| List threads | `["get", "support_threads"]` |
| Get single thread | `["get", "support_thread_by_id"]` |
| Create thread | `["create", "support_thread"]` |
| Close thread | `["close", "support_thread"]` |
| Add message | `["create", "support_message"]` |

---

## Common Pitfalls

1. **Multiple sessions per request** — causes `ExceptionGroup` errors. Open one `mcp_session(settings)` and pass the session object to all tool calls.

2. **Entity IDs are strings, not integers** — the MCP layer wraps the API's integer IDs with GUID-like strings (e.g. `lc_e9a2a7d8-...`). Always pass and store them as `str`.

3. **Paginated list response** — `get_support_threads` returns `{ data: [...], total, page, totalPages }`, not a raw array. Extract items from the `data` key.

4. **Tool name collisions** — `create_support_thread` and `create_support_message` both contain `"create"` and `"support"`. Use sufficiently specific patterns (e.g., `["create", "support_message"]` not just `["create", "support"]`).

5. **No update category tool exposed** — the categorization endpoint (`PUT /:supportThreadId`) exists as a separate HTTP route on the MCP server but is **not** exposed as an MCP tool. If needed, call it directly via HTTP instead of through MCP.
