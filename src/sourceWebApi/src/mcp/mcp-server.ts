import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import { registerSupportThreadTools } from './tools/support-thread.tools';

function configureServer(server: McpServer): void {
  registerSupportThreadTools(server);
}

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'consumer-reviews-api',
    version: '1.0.0',
  });

  configureServer(server);

  return server;
}

export function createHttpTransport(server: McpServer): StreamableHTTPServerTransport {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  server.connect(transport);

  return transport;
}

export async function startMcpServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server running on stdio');
}
