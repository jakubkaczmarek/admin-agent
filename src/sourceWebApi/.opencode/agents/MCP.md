# MCP Server Guide

## Overview

This project includes an **MCP (Model Context Protocol) server** that runs alongside the REST API. The MCP server provides tools for AI assistants to interact with the application's business logic directly.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  MCP Client     │────▶│  MCP Server      │────▶│  Services       │
│  (AI Assistant) │     │  (stdio/SSE)     │     │  (Business Logic)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Repositories   │
                                               │  (CSV Access)   │
                                               └─────────────────┘
```

## Key Rules

1. **MCP tools call services directly** — never controllers, never repositories
2. **One tool file per domain** — mirrors the `services/` structure
3. **Always handle errors gracefully** — return structured error responses
4. **Use descriptive tool names** — snake_case with clear action verbs
5. **Use zod/v4 for schemas** — import as `import * as z from 'zod/v4'`

## File Structure

```
src/mcp/
├── mcp-server.ts           # Server instance + tool registration
└── tools/
    ├── consumer-review.tools.ts   # Consumer review domain tools
    └── ...
```

## Creating a New Tool

### Step 1: Create the tool file

```typescript
// src/mcp/tools/example.tools.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ExampleService } from '../services/example.service';
import * as z from 'zod/v4';

const service = new ExampleService();

export function registerExampleTools(server: McpServer) {
  server.registerTool('example_action', {
    title: 'Example Action',
    description: 'Description of what the tool does',
    inputSchema: {
      paramName: z.string().describe('Description of the parameter'),
    },
  }, async ({ paramName }) => {
    try {
      const result = await service.someMethod(paramName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data: result }, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: message }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
}
```

### Step 2: Register the tool

```typescript
// src/mcp/mcp-server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerConsumerReviewTools } from './tools/consumer-review.tools';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'consumer-reviews-api',
    version: '1.0.0',
  });

  registerConsumerReviewTools(server);

  return server;
}
```

## Available Tools

### `get_reviews_by_date_range`

Get consumer reviews filtered by date range.

**Input Schema:**
```typescript
{
  startDate: z.string().describe('Start date in YYYY-MM-DD format (inclusive)'),
  endDate: z.string().describe('End date in YYYY-MM-DD format (inclusive)'),
  status: z.enum(['new', 'auto-accepted', 'accepted', 'rejected']).optional().describe('Optional status filter'),
}
```

**Example:**
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "Id": 1,
      "ClientId": 3,
      "DateTime": "2026-01-01 08:12:14.1234567",
      "Rating": 5,
      "Comment": "Absolutely outstanding service...",
      "sourceFile": "consumerReviews_january2026.csv",
      "status": "new"
    }
  ]
}
```

### `update_review_status`

Update the status of a specific review.

**Input Schema:**
```typescript
{
  id: z.number().int().positive().describe('Review ID'),
  file: z.string().describe('CSV file name (e.g., consumerReviews_january2026.csv)'),
  status: z.enum(['new', 'auto-accepted', 'accepted', 'rejected']).describe('New status'),
}
```

**Example:**
```json
{
  "id": 1,
  "file": "consumerReviews_january2026.csv",
  "status": "accepted"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "Id": 1,
    "ClientId": 3,
    "DateTime": "2026-01-01 08:12:14.1234567",
    "Rating": 5,
    "Comment": "Absolutely outstanding service...",
    "status": "accepted"
  }
}
```

## Transport

The MCP server uses **stdio transport** by default, which means it communicates via standard input/output. This is ideal for local AI assistant integration.

## Error Handling

All tool errors are caught and returned as structured JSON:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

The `isError: true` flag is set on failed tool calls.

## Testing

Run the server and connect via an MCP client:

```bash
npm run dev
```

The MCP server will start automatically alongside the REST API.
