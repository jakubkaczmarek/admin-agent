# MCP Server Issue: First Request Succeeds, Subsequent Requests Fail

## Problem Description

**Date:** 2026-04-12  
**Status:** Confirmed reproducible issue

### Symptoms
- ✅ **First request** (after server restart) → **succeeds**
- ❌ **All subsequent requests** → **fail with HTTP 400 Bad Request**
- Affects all clients (Postman, web app HTTP calls, etc.)
- Restarting both MCP server and agent temporarily fixes it (first request works again)

### Error Log
```
INFO:app.agents.ticket_agent:Generated 1 valid tickets
INFO:httpx:HTTP Request: POST http://localhost:3000/mcp "HTTP/1.1 400 Bad Request"
ERROR:app.main:Unexpected error during ticket generation: unhandled errors in a TaskGroup (1 sub-exception)
INFO: 127.0.0.1:62745 - "POST /tickets/generate HTTP/1.1" 503 Service Unavailable
```

### Evidence from Logs
1. **First successful call:**
   - Session established: `Received session ID: 2a3756b7-b8b1-47a5-b3a4-dd2f1ee05a0e`
   - Tool found and executed successfully
   - Response: `201 Created`

2. **All subsequent calls:**
   - Fail at: `POST http://localhost:3000/mcp "HTTP/1.1 400 Bad Request"`
   - Never reaches tool execution
   - Response: `503 Service Unavailable`

## Root Cause Analysis

**Likely cause:** The MCP server is not properly handling session lifecycle or has state management issues:

1. **Session reuse problem:** The MCP server may be rejecting new session initialization requests after the first session was created
2. **Connection state not cleaned up:** After the first session disconnects (`GET stream disconnected`), the server might not be properly cleaning up resources
3. **Concurrent session handling:** The server might not support multiple sequential sessions from the same client

## Recommended Fix (MCP Server Side)

### Immediate Actions
1. **Check session lifecycle handling:**
   - Ensure each new `POST /mcp` request can initialize a fresh session
   - Verify that session IDs are unique and not conflicting
   
2. **Implement proper session cleanup:**
   - When `DELETE /mcp` is called (session close), clean up all server-side state
   - Ensure the server is ready to accept new session requests

3. **Add error logging on MCP server:**
   - Log why `400 Bad Request` is returned
   - Include details about what validation failed

### Code Review Points
```python
# On MCP server, check:
# 1. Session initialization endpoint
@app.post("/mcp")
async def handle_mcp():
    # Is this properly creating a NEW session each time?
    # Or is it trying to reuse a stale one?
    pass

# 2. Session cleanup
@app.delete("/mcp")
async def close_mcp():
    # Is this cleaning up ALL state?
    # Can a new session be created immediately after?
    pass
```

### Testing MCP Server Directly
Test the MCP server in isolation (without the agent):
```bash
# Test 1: First session
curl -X POST http://localhost:3000/mcp

# Test 2: Second session (should also work)
curl -X POST http://localhost:3000/mcp

# Both should return 200 with unique session IDs
```

## Workaround (Client Side)
Until MCP server is fixed, we could:
1. Keep a persistent session open instead of creating/closing per request
2. Add retry logic with session recreation on 400 errors
3. Add a delay between requests to allow server cleanup

**Note:** These are temporary workarounds; the MCP server needs to be fixed for production reliability.

## Status
🔴 **BLOCKED** - Requires MCP server fix before agent can work reliably
