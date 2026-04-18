# Web API

REST API and MCP server for the support ticketing system.

## Quick Start

```bash
npm install
npm run dev    # REST API + MCP server
npm run build && npm start  # production
```

## REST API

All endpoints are prefixed with `/support-threads`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create a new thread with an initial message |
| `GET` | `/` | List threads (paginated; filter by `status`) |
| `GET` | `/:id` | Get a thread with all its messages |
| `POST` | `/:id/messages` | Add a message to a thread |
| `POST` | `/:id/closed` | Close a thread |
| `PUT` | `/:id` | Update thread category (`SupportAgent` only) |
| `DELETE` | `/` | Delete all threads |

**Create thread** — `POST /support-threads`
```json
{ "creatorUserName": "alice", "subject": "Login broken", "category": "Auth", "message": "..." }
```

**List threads** — `GET /support-threads?pageIndex=0&pageSize=20&status=active`

**Add message** — `POST /support-threads/:id/messages`
```json
{ "creatorUserName": "alice", "message": "Still not working." }
```

**Update category** — `PUT /support-threads/:id`
```json
{ "category": "Billing", "userName": "SupportAgent" }
```

All responses use `{ "success": true, "data": ... }` / `{ "success": false, "error": "..." }`.

## MCP Server

The API doubles as an MCP server at `/mcp` (`streamable_http` transport), exposing five tools to AI agents:

| Tool | Description |
|------|-------------|
| `create_support_thread` | Create a thread with an initial message |
| `create_support_message` | Add a message to an existing thread |
| `close_support_thread` | Close a thread |
| `get_support_threads` | List threads with optional pagination and status filter |
| `update_thread_category` | Update a thread's category (requires `userName: "SupportAgent"`) |

A stdio transport is also available for local AI assistant clients (`npm run mcp`).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DB_*` | MSSQL connection settings | — |
| `NODE_ENV` | Environment | `development` |
