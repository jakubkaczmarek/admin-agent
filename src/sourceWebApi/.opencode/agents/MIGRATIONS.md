# MIGRATIONS.md — Database Migrations

## Overview

Database migrations are managed with **`db-migrate`** and the **`db-migrate-mssql`**
driver. Migration files live in `migrations/` at the project root. The migration
runner tracks which files have already been applied in a `migrations` table it
creates automatically in the target database.

---

## Packages

```bash
npm install --save-dev db-migrate db-migrate-mssql
```

---

## Project Structure

```
project-root/
├── .opencode/
│   └── agents/
│       ├── AGENTS.md
│       ├── ARCHITECTURE.md
│       ├── CONVENTIONS.md
│       ├── MCP.md
│       └── MIGRATIONS.md       # This file
├── migrations/
│   ├── sqls/
│   │   ├── 20240101000000-create-users-up.sql
│   │   ├── 20240101000000-create-users-down.sql
│   │   └── ...
│   └── 20240101000000-create-users.js   # db-migrate entry point (auto-generated)
├── database.json                        # db-migrate connection config
├── src/
│   └── ...
```

---

## Configuration (`database.json`)

`database.json` is read by `db-migrate` at runtime. It must **never** be committed
with real credentials — use environment variable references instead.

```json
{
  "dev": {
    "driver": "mssql",
    "host":     { "ENV": "DB_SERVER" },
    "port":     { "ENV": "DB_PORT" },
    "database": { "ENV": "DB_NAME" },
    "user":     { "ENV": "DB_USER" },
    "password": { "ENV": "DB_PASSWORD" },
    "options": {
      "encrypt": true,
      "trustServerCertificate": true
    }
  },
  "production": {
    "driver": "mssql",
    "host":     { "ENV": "DB_SERVER" },
    "port":     { "ENV": "DB_PORT" },
    "database": { "ENV": "DB_NAME" },
    "user":     { "ENV": "DB_USER" },
    "password": { "ENV": "DB_PASSWORD" },
    "options": {
      "encrypt": true,
      "trustServerCertificate": false
    }
  }
}
```

---

## npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "migrate:create": "db-migrate create --sql-file",
    "migrate:up":     "db-migrate up",
    "migrate:down":   "db-migrate down",
    "migrate:status": "db-migrate status"
  }
}
```

| Script | What it does |
|---|---|
| `migrate:create <name>` | Scaffolds a new timestamped migration (JS + up/down SQL files) |
| `migrate:up` | Applies all pending migrations in order |
| `migrate:down` | Rolls back the most recently applied migration |
| `migrate:status` | Lists all migrations and whether each has been applied |

---

## Creating a Migration

Always use the `migrate:create` script — never create files manually:

```bash
npm run migrate:create -- add-users-table
# generates:
#   migrations/20240315120000-add-users-table.js
#   migrations/sqls/20240315120000-add-users-table-up.sql
#   migrations/sqls/20240315120000-add-users-table-down.sql
```

The `.js` file is auto-generated boilerplate — do not edit it. All SQL goes in
the `-up.sql` and `-down.sql` files.

---

## Migration File Templates

### Up migration (`-up.sql`)

```sql
CREATE TABLE users (
  id       NVARCHAR(36)  NOT NULL PRIMARY KEY,
  name     NVARCHAR(255) NOT NULL,
  email    NVARCHAR(255) NOT NULL UNIQUE,
  age      INT           NOT NULL,
  created_at DATETIME2   NOT NULL DEFAULT GETUTCDATE()
);
```

### Down migration (`-down.sql`)

```sql
DROP TABLE IF EXISTS users;
```

---

## Migration Naming Conventions

Migration names must be descriptive and follow `kebab-case`:

| ✅ Good | ❌ Bad |
|---|---|
| `add-users-table` | `users` |
| `add-email-index-to-users` | `update` |
| `drop-legacy-products-table` | `fix` |
| `rename-user-fullname-to-name` | `migration1` |

The timestamp prefix is added automatically — never include it in the name you pass to `migrate:create`.

---

## SQL Conventions Inside Migrations

- Use `NVARCHAR` for all string columns (Unicode-safe for MSSQL)
- Use `DATETIME2` for all timestamps, always default to `GETUTCDATE()` (UTC)
- Use `NVARCHAR(36)` for UUID primary keys
- Always define a `NOT NULL` constraint unless the column is explicitly optional
- Always include a `-down.sql` that fully reverses the `-up.sql`
- Never reference application logic (stored procs, triggers) in migrations — schema changes only
- Wrap multi-statement migrations in a transaction:

```sql
BEGIN TRANSACTION;

ALTER TABLE users ADD phone NVARCHAR(50) NULL;
ALTER TABLE users ADD phone_verified BIT NOT NULL DEFAULT 0;

COMMIT;
```

---

## Applying Migrations

### Development
```bash
npm run migrate:up
```

### CI / Production
Run migrations as a **pre-start step** before the app boots — never inside `server.ts`:

```bash
npm run migrate:up && npm start
```

Or as separate stages in your pipeline:
```
1. npm run migrate:up    ← migration stage
2. npm start             ← app stage
```

---

## Key Rules for the Agent

1. **Never create migration files manually** — always use `npm run migrate:create`
2. **All SQL goes in the `.sql` files** — never edit the auto-generated `.js` file
3. **Every up migration must have a down migration** that fully reverses it
4. **Never modify an already-applied migration** — create a new one instead
5. **Never run migrations inside `server.ts`** — migrations are a separate pipeline step
6. **Always use parameterised names** in `migrate:create` — `kebab-case`, descriptive, no timestamps
7. **Schema changes only** in migrations — no seed data, no stored procedures
8. **Multi-statement migrations must use a transaction** — wrap in `BEGIN TRANSACTION` / `COMMIT`
9. **`database.json` must only reference env vars** — never hardcode credentials
