# AGENTS.md — Node.js REST API + MCP Server Project

## Project Overview

This is a **Node.js REST API** built with **TypeScript** and **Express**.
Data is persisted in a **Microsoft SQL Server (MSSQL)** database. The project
follows a **layer-based architecture**: Controllers → Services → Repositories.

The app also exposes an **MCP (Model Context Protocol) server** running in the
same process as the REST API. MCP tools call **services directly** — they do
not go through HTTP. See `.opencode/agents/MCP.md` for full MCP guidance.

Database schema changes are managed via **`db-migrate`** migrations.
See `.opencode/agents/MIGRATIONS.md` for full migrations guidance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (v20+) |
| Language | TypeScript (strict mode) |
| Framework | Express.js |
| Database | Microsoft SQL Server |
| DB client | `mssql` |
| Validation | `zod` |
| MCP server | `@modelcontextprotocol/sdk` |
| Dev tooling | `tsx` (run TS directly), `eslint`, `prettier` |

---

## Project Structure

```
project-root/
├── .opencode/
│   └── agents/
│       ├── AGENTS.md           # This file — main entry point for the agent
│       ├── ARCHITECTURE.md     # Detailed architecture decisions & code templates
│       ├── CONVENTIONS.md      # Coding conventions and rules
│       ├── MCP.md              # MCP server setup, tool patterns & rules
│       └── MIGRATIONS.md       # DB migration setup, conventions & rules
├── migrations/
│   ├── sqls/                   # Raw SQL files (up + down per migration)
│   └── *.js                    # Auto-generated db-migrate entry points
├── src/
│   ├── controllers/            # HTTP layer: parse request, call service, send response
│   ├── services/               # Business logic layer (shared by REST + MCP)
│   ├── repositories/           # Data access layer: executes SQL queries via mssql
│   ├── routes/                 # Express route definitions (maps URLs to controllers)
│   ├── models/                 # TypeScript interfaces and Zod schemas
│   ├── middleware/             # Express middleware (error handler, validator, logger)
│   ├── mcp/
│   │   ├── tools/              # One file per domain (e.g. user.tools.ts)
│   │   └── mcp-server.ts       # MCP server instance + tool registration
│   ├── utils/                  # Shared helpers (db client, response formatter, etc.)
│   ├── app.ts                  # Express app setup (middleware, routes registration)
│   └── server.ts               # Entry point — starts both REST API and MCP server
├── package.json
├── tsconfig.json
├── database.json               # db-migrate connection config (uses env vars — never hardcode credentials)
└── .env.example
```

---

## Layer Responsibilities

### `repositories/`
- **Only** layer that interacts with the MSSQL database
- Uses the shared `db` connection pool from `utils/db.ts`
- Executes parameterised SQL queries — **never** raw string interpolation
- Returns plain TypeScript objects matching the model interface
- Must **never** contain business logic
- One repository per domain entity / table

### `services/`
- Contains **all business logic** (filtering, sorting, transforming, calculations)
- Calls repositories to get raw data
- Returns processed data to controllers
- Must **never** import Express types (`Request`, `Response`)

### `controllers/`
- Handles HTTP concerns only: parse `req.params`, `req.query`, `req.body`
- Calls the appropriate service method
- Sends HTTP response via `res.json()` or `res.status().json()`
- Must **never** contain business logic

### `routes/`
- Maps HTTP verbs + paths to controller methods
- Applies route-level middleware (e.g., validation)
- Registered in `app.ts`

### `mcp/`
- Contains the MCP server instance and all tool definitions
- Tools call **services directly** — never controllers, never repositories
- One file per domain in `mcp/tools/` (mirrors the `services/` structure)
- See `MCP.md` for full patterns and rules

### `models/`
- TypeScript `interface` definitions for all entities
- Zod schemas for request validation
- No logic — types and schemas only

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `user.repository.ts` |
| Classes | `PascalCase` | `UserRepository` |
| Functions / variables | `camelCase` | `getUserById` |
| Interfaces | `PascalCase` with `I` prefix | `IUser` |
| Zod schemas | `camelCase` + `Schema` suffix | `createUserSchema` |
| Routes | Plural nouns, lowercase | `/users`, `/products` |

---

## Error Handling

- All async controller methods must be wrapped with `asyncHandler` utility
- Services throw typed errors (e.g., `NotFoundError`, `ValidationError`)
- A global error-handling middleware in `middleware/error-handler.ts` catches all errors
- HTTP responses always follow this shape:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Human-readable message" }
```

---

## Environment Variables

Stored in `.env` (never committed). Use `.env.example` as the template.

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port the REST API listens on | `3000` |
| `MCP_PORT` | HTTP port the MCP server listens on | `3001` |
| `DB_SERVER` | MSSQL server hostname or IP | *(required)* |
| `DB_PORT` | MSSQL server port | `1433` |
| `DB_NAME` | Database name | *(required)* |
| `DB_USER` | Database login username | *(required)* |
| `DB_PASSWORD` | Database login password | *(required)* |
| `DB_ENCRYPT` | Enforce TLS encryption (`true`/`false`) | `true` |
| `NODE_ENV` | `development` or `production` | `development` |

---

## Scripts (package.json)

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "migrate:create": "db-migrate create --sql-file",
    "migrate:up":     "db-migrate up",
    "migrate:down":   "db-migrate down",
    "migrate:status": "db-migrate status"
  }
}
```

---

## Key Rules for the Agent

1. **Always use TypeScript** — no plain `.js` files in `src/`
2. **Never put logic in controllers** — delegate to services
3. **Never access the database outside repositories** — keep data access isolated
4. **Always use parameterised queries** — never interpolate user input into SQL strings
5. **Always validate incoming request data** using Zod before passing to service
6. **Always handle async errors** — use `asyncHandler` wrapper or try/catch
7. **Return consistent response shapes** — use the `{ success, data/error }` format
8. **No `any` types** — use proper interfaces or `unknown` when type is unclear
9. **MCP tools must call services** — never bypass the service layer to hit repositories or the DB directly
10. **Read MCP.md before writing any MCP code** — tool registration, error handling, and transport setup have specific patterns
11. **Never modify an already-applied migration** — always create a new one
12. **Read MIGRATIONS.md before creating any migration** — naming, SQL conventions, and transaction rules all apply
