#!/usr/bin/env node

import { startMCPServer } from './mcp-server.js';
import { startHTTPServer } from './http-server.js';

const args = process.argv.slice(2);

async function main() {
  const mode = args.includes('--mcp') ? 'mcp' : args.includes('--http') ? 'http' : 'http';

  if (mode === 'mcp') {
    // Run as MCP server (stdio transport for Claude Desktop)
    await startMCPServer();
  } else {
    // Run as HTTP server (for web client)
    await startHTTPServer();
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
