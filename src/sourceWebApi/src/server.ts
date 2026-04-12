import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { closePool, getPool } from './utils/db';
import consumerReviewRoutes from './routes/consumer-review.routes';
import supportThreadRoutes from './routes/support-threads.routes';
import { createMcpServer, createHttpTransport, startMcpServer } from './mcp/mcp-server';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOrigins = process.env.CORS_ORIGINS;
if (corsOrigins) {
  const originsList = corsOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (originsList.includes(origin)) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
} else {
  // If CORS_ORIGINS not set, allow all origins (development mode)
  app.use(cors());
}

app.use(express.json());

app.use('/reviews', consumerReviewRoutes);
app.use('/support-threads', supportThreadRoutes);

// MCP HTTP Streamable endpoint
// Create a new transport instance per session to properly handle session lifecycle.
// The StreamableHTTPServerTransport has internal state tied to a single session,
// and reusing one transport across multiple sessions causes 400 errors after disconnect.
const httpMcpServer = createMcpServer();

// Map to store transports by session ID for proper lifecycle management
const transportsBySessionId = new Map<string, StreamableHTTPServerTransport>();

// Store the most recently created transport for the initialization handshake
let pendingInitTransport: StreamableHTTPServerTransport | null = null;

app.all('/mcp', async (req, res) => {
  try {
    // Extract session ID from request headers (sent by client on subsequent requests)
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transportsBySessionId.has(sessionId)) {
      // Reuse existing transport for this session
      transport = transportsBySessionId.get(sessionId)!;
    } else if (!sessionId && req.method === 'POST') {
      // New session initialization request - create a fresh transport
      transport = createHttpTransport(httpMcpServer);
      pendingInitTransport = transport;

      // Wrap res.writeHead to capture the session ID from response headers
      const originalWriteHead = res.writeHead.bind(res);
      res.writeHead = function (statusCode: number, statusMessage?: any, headers?: any) {
        // Headers might be in statusMessage or headers argument
        let sessionHeader: string | undefined;
        if (typeof statusMessage === 'object' && statusMessage !== null) {
          sessionHeader = statusMessage['mcp-session-id'] || statusMessage['Mcp-Session-Id'];
        }
        if (headers && typeof headers === 'object') {
          sessionHeader = headers['mcp-session-id'] || headers['Mcp-Session-Id'];
        }
        if (sessionHeader) {
          transportsBySessionId.set(sessionHeader, transport);
          pendingInitTransport = null;
        }
        return originalWriteHead(statusCode, statusMessage, headers);
      };
    } else if (sessionId && req.method === 'DELETE') {
      // Session close - clean up transport
      if (transportsBySessionId.has(sessionId)) {
        const transportToClose = transportsBySessionId.get(sessionId)!;
        await transportToClose.close();
        transportsBySessionId.delete(sessionId);
      }
      res.status(200).send();
      return;
    } else {
      // Invalid state - no session ID provided for non-initialization, or session not found
      if (!res.headersSent) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: sessionId ? 'Session not found' : 'Missing session ID',
          },
          id: null,
        });
      }
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP HTTP error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get('/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');

    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service unavailable',
      data: {
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Start stdio MCP server (for AI assistants like Qwen Code, Cursor, etc.)
const stdioMcpServer = createMcpServer();
startMcpServer(stdioMcpServer).catch((err) => {
  console.error('Failed to start MCP stdio server:', err);
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  server.close(async () => {
    await closePool();
    // Close all active transports
    for (const transport of transportsBySessionId.values()) {
      try {
        await transport.close();
      } catch {
        // Ignore errors during shutdown
      }
    }
    transportsBySessionId.clear();
    await httpMcpServer.close();
    await stdioMcpServer.close();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  server.close(async () => {
    await closePool();
    // Close all active transports
    for (const transport of transportsBySessionId.values()) {
      try {
        await transport.close();
      } catch {
        // Ignore errors during shutdown
      }
    }
    transportsBySessionId.clear();
    await httpMcpServer.close();
    await stdioMcpServer.close();
    console.log('Server closed');
    process.exit(0);
  });
});
