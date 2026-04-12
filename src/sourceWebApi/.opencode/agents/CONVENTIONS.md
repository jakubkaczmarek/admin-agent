# CONVENTIONS.md — Coding Conventions & Rules

## TypeScript Rules

- `strict: true` is enabled in `tsconfig.json` — no exceptions
- Never use `any` — use `unknown` or a proper interface instead
- Always type function return values explicitly
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, intersections, or aliases

```typescript
// ✅ Good
async function getUser(id: string): Promise<IUser> { ... }

// ❌ Bad
async function getUser(id) { ... }
async function getUser(id: any): Promise<any> { ... }
```

---

## Express Rules

- Controllers must **only** interact with `req`, `res`, and services
- Never `import` a repository directly in a controller
- Always use `asyncHandler` for async controllers — never raw async route handlers

```typescript
// ✅ Good
router.get('/', asyncHandler(myController));

// ❌ Bad — unhandled promise rejections
router.get('/', async (req, res) => { ... });
```

---

## Response Format

Every endpoint must return this exact shape:

```typescript
// 2xx success
res.json({ success: true, data: <your payload> });

// 4xx / 5xx error (handled by error middleware — don't do this manually)
res.status(404).json({ success: false, error: "Not found" });
```

---

## MSSQL / Repository Rules

- All database access goes through `utils/db.ts` — call `getPool()` in every repository method
- Repositories are the **only** files that import `mssql` or call `getPool()`
- **Always use parameterised inputs** via `.input('name', sql.Type, value)` — never interpolate user data into query strings
- Column names returned by `mssql` must match the property names in the model interface (use `AS` aliases in SQL if needed)
- Services must **never** import `mssql` or write SQL

```typescript
// ✅ Good — parameterised query
const result = await pool
  .request()
  .input('id', sql.VarChar, id)
  .query('SELECT * FROM users WHERE id = @id');

// ❌ Bad — SQL injection risk
const result = await pool
  .request()
  .query(`SELECT * FROM users WHERE id = '${id}'`);
```

---

## File & Folder Naming

```
src/controllers/user.controller.ts      ✅
src/controllers/UserController.ts       ❌
src/services/product-category.service.ts  ✅
src/repositories/order.repository.ts   ✅
```

---

## Imports — Order

Organize imports in this order (separated by blank lines):

```typescript
// 1. Node built-ins
import path from 'path';

// 2. Third-party
import sql from 'mssql';
import { z } from 'zod';
import express from 'express';

// 3. Internal
import { IUser } from '../models/user.model';
import { UserRepository } from '../repositories/user.repository';
```

---

## What NOT to Do

| ❌ Don't | ✅ Do instead |
|---|---|
| Interpolate user input into SQL strings | Use `.input('param', sql.Type, value)` |
| Import `mssql` outside repositories | Call repository methods from services |
| Create a new `ConnectionPool` per request | Use the shared `getPool()` singleton |
| Put logic in controllers | Move to service |
| Use `console.log` for errors | Throw a typed error |
| Catch errors in every controller | Use `asyncHandler` + global error middleware |
| Use `require()` | Use ES module `import` |
| Hardcode DB connection strings | Use `process.env.DB_*` variables |

---

## tsconfig.json (reference)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```
