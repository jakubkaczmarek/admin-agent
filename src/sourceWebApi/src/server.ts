import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { closePool, getPool } from './utils/db';
import consumerReviewRoutes from './routes/consumer-review.routes';
import supportThreadRoutes from './routes/support-threads.routes';
import { createMcpServer, createHttpTransport, startMcpServer } from './mcp/mcp-server';

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

// MCP HTTP Streamable endpoint (separate instance for HTTP)
const httpMcpServer = createMcpServer();
const mcpHttpTransport = createHttpTransport(httpMcpServer);

app.all('/mcp', async (req, res) => {
  try {
    // Pass req.body (already parsed by express.json()) to the transport
    await mcpHttpTransport.handleRequest(req, res, req.body);
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
    await mcpHttpTransport.close();
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
    await mcpHttpTransport.close();
    await httpMcpServer.close();
    await stdioMcpServer.close();
    console.log('Server closed');
    process.exit(0);
  });
});
