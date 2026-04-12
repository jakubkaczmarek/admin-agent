import { createMcpServer, startMcpServer } from './mcp/mcp-server';

const mcpServer = createMcpServer();

startMcpServer(mcpServer).catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.error('Shutting down MCP server...');
  await mcpServer.close();
  console.error('MCP server closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down MCP server...');
  await mcpServer.close();
  console.error('MCP server closed');
  process.exit(0);
});
