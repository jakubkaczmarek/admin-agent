# Consumer Reviews API

REST API for accessing consumer reviews from CSV files by date range with status management.

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode (REST API + MCP server)
npm run dev

# Run only MCP server (stdio transport)
npm run mcp

# Build for production
npm run build
npm start
```

## API Endpoints

All REST endpoints are prefixed with `/reviews`.

### Get Reviews by Date Range
```
GET /reviews?startDate=2026-01-01&endDate=2026-01-31&status=accepted
```

Loads all `consumerReviews_*.csv` files and returns reviews matching the date range.

**Parameters:**
- `startDate` (required): Start date in `YYYY-MM-DD` format
- `endDate` (required): End date in `YYYY-MM-DD` format
- `status` (optional): Filter by status (`new`, `pending-review`, `auto-accepted`, `auto-rejected`, `accepted`, `rejected`)

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

### Get Unprocessed Reviews
```
GET /reviews/unprocessed?pageSize=10&skipCount=0
```

Returns reviews with `pending-review` status with pagination.

**Response:**
```json
{
  "success": true,
  "data": {
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 42,
    "items": [...]
  }
}
```

### Accept Review
```
POST /reviews/:id/accept
```

Sets review status to `accepted`.

### Auto-Accept Review
```
POST /reviews/:id/auto-accept
```

Sets review status to `auto-accepted`.

### Pending Review
```
POST /reviews/:id/pending
```

Sets review status to `pending-review`.

### Auto-Reject Review
```
POST /reviews/:id/auto-reject
```

Sets review status to `auto-rejected`.

### Reject Review
```
POST /reviews/:id/reject
```

Sets review status to `rejected`.

## Review Statuses

| Status | Value | Description |
|--------|-------|-------------|
| `new` | 0 | Initial, default status |
| `auto-accepted` | 1 | Automatically accepted (e.g., by AI filter) |
| `auto-rejected` | 2 | Automatically rejected (e.g., by AI filter) |
| `pending-review` | 3 | Awaiting manual review |
| `accepted` | 4 | Manually accepted |
| `rejected` | 5 | Manually rejected |

## MCP Server

This application includes an **MCP (Model Context Protocol) server** that provides tools for AI assistants.

### Running the MCP Server

**Development mode:**
```bash
npm run mcp
```

**Production mode:**
```bash
node dist/mcp-standalone.js
```

**As a CLI command (after npm install -g):**
```bash
consumer-reviews-mcp
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_reviews_by_date_range` | Get consumer reviews filtered by date range and optional status |
| `update_review_status` | Update the status of a specific review (any status) |
| `auto_accept_review` | Auto-accept a specific review (sets status to auto-accepted) |
| `pending_review` | Set a specific review to pending review status |
| `auto_reject_review` | Auto-reject a specific review (sets status to auto-rejected) |
| `get_unprocessed_reviews` | Get unprocessed reviews with pagination (status = pending-review) |

### Configuring MCP Client

Add to your AI assistant's MCP configuration:

```json
{
  "mcpServers": {
    "consumer-reviews": {
      "command": "node",
      "args": ["./dist/mcp-standalone.js"],
      "cwd": "/path/to/sourceWebApi"
    }
  }
}
```

Or use the provided `.mcp.json` file in the project root.

## Response Format

```json
{
  "success": true,
  "data": { ... }
}
```

Errors:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `CSV_DATA_DIR` | Path to CSV files | `./data` |
| `NODE_ENV` | Environment | `development` |
