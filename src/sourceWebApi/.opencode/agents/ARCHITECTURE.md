# ARCHITECTURE.md — Detailed Patterns & Examples

## Request Lifecycle

```
HTTP Request
    ↓
routes/          → defines which controller handles this URL
    ↓
middleware/      → validates request body/params (Zod)
    ↓
controllers/     → extracts data from req, calls service
    ↓
services/        → applies business logic, calls repository
    ↓
repositories/    → executes parameterised SQL via mssql connection pool
    ↓
services/        → transforms/filters data
    ↓
controllers/     → sends res.json({ success: true, data })
    ↓
HTTP Response
```

---

## File Templates

### Model (`src/models/user.model.ts`)

```typescript
import { z } from 'zod';

// TypeScript interface — shape of a User object
export interface IUser {
  id: string;
  name: string;
  email: string;
  age: number;
}

// Zod schema — validates incoming POST/PUT request bodies
export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
```

---

### Repository (`src/repositories/user.repository.ts`)

```typescript
import sql from 'mssql';
import { getPool } from '../utils/db';
import { IUser } from '../models/user.model';

export class UserRepository {
  async findAll(): Promise<IUser[]> {
    const pool = await getPool();
    const result = await pool.request().query<IUser>(
      'SELECT id, name, email, age FROM users ORDER BY name'
    );
    return result.recordset;
  }

  async findById(id: string): Promise<IUser | undefined> {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.VarChar, id)          // always use .input() — never string interpolation
      .query<IUser>('SELECT id, name, email, age FROM users WHERE id = @id');
    return result.recordset[0];
  }
}
```

---

### Service (`src/services/user.service.ts`)

```typescript
import { UserRepository } from '../repositories/user.repository';
import { IUser } from '../models/user.model';
import { NotFoundError } from '../utils/errors';

export class UserService {
  private repo = new UserRepository();

  async getAllUsers(): Promise<IUser[]> {
    return this.repo.findAll();
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError(`User with id "${id}" not found`);
    return user;
  }
}
```

---

### Controller (`src/controllers/user.controller.ts`)

```typescript
import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { asyncHandler } from '../utils/async-handler';

const service = new UserService();

export const getAllUsers = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.getAllUsers();
  res.json({ success: true, data });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getUserById(req.params.id);
  res.json({ success: true, data });
});
```

---

### Routes (`src/routes/user.routes.ts`)

```typescript
import { Router } from 'express';
import { getAllUsers, getUserById } from '../controllers/user.controller';

const router = Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);

export default router;
```

---

### App setup (`src/app.ts`)

```typescript
import express from 'express';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/error-handler';

const app = express();

app.use(express.json());

// Register routes
app.use('/users', userRoutes);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
```

---

## Utility Patterns

### DB Connection Pool (`src/utils/db.ts`)

```typescript
import sql from 'mssql';

const config: sql.config = {
  server:   process.env.DB_SERVER ?? '',
  port:     Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME ?? '',
  user:     process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  options: {
    encrypt:                process.env.DB_ENCRYPT !== 'false',  // true by default
    trustServerCertificate: process.env.NODE_ENV !== 'production', // self-signed certs in dev only
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

let pool: sql.ConnectionPool | null = null;

// Returns a shared, lazily-initialised connection pool.
// Call this in every repository method — never create a new ConnectionPool directly.
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await new sql.ConnectionPool(config).connect();
  }
  return pool;
}

// Call once on graceful shutdown (e.g. SIGTERM handler in server.ts)
export async function closePool(): Promise<void> {
  await pool?.close();
  pool = null;
}
```

### Async Handler (`src/utils/async-handler.ts`)

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wraps async controllers so errors bubble to the global error handler
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### Custom Errors (`src/utils/errors.ts`)

```typescript
export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Global Error Handler (`src/middleware/error-handler.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';
  res.status(statusCode).json({ success: false, error: message });
}
```
