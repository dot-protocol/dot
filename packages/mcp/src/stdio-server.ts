/**
 * stdio-server.ts — Real MCP server over stdio using @modelcontextprotocol/sdk.
 *
 * This module wires the DOT tool handlers (from handlers.ts) into the official
 * MCP SDK Server + StdioServerTransport. It handles the three core JSON-RPC
 * methods required by the MCP protocol:
 *
 *   initialize     → capabilities advertisement
 *   tools/list     → all 11 DOT tool definitions
 *   tools/call     → dispatch to the appropriate handler
 *
 * Usage (in a CLI entrypoint):
 *   import { startStdioServer } from './stdio-server.js';
 *   await startStdioServer();
 *
 * The implementation uses the low-level SDK Server (not McpServer) so we can
 * supply our own JSON Schema tool definitions directly, avoiding the Zod
 * dependency that McpServer requires.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ALL_TOOLS } from './tools.js';
import { createDotMCPServer } from './server.js';

// ---------------------------------------------------------------------------
// Build the SDK-compatible tool list once (shape matches MCP ToolSchema)
// ---------------------------------------------------------------------------

const sdkTools = ALL_TOOLS.map(t => ({
  name: t.name,
  description: t.description,
  inputSchema: {
    type: 'object' as const,
    properties: t.inputSchema.properties ?? {},
    required: t.inputSchema.required ?? [],
  },
}));

// ---------------------------------------------------------------------------
// createSdkServer — returns a configured SDK Server (not yet connected)
// ---------------------------------------------------------------------------

/**
 * Create a real MCP SDK Server configured with all 11 DOT tools.
 *
 * The server is not yet connected to a transport. Call connect() or use
 * startStdioServer() to connect and run.
 *
 * @returns Configured SDK Server instance.
 */
export function createSdkServer(): Server {
  const server = new Server(
    { name: '@dot-protocol/mcp', version: '1.0.0-alpha.0' },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Internal DOT server for handler dispatch
  const dotServer = createDotMCPServer();

  // tools/list — return all 11 tool definitions
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: sdkTools,
  }));

  // tools/call — dispatch to handler via our MCPServer abstraction
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const params = (args ?? {}) as Record<string, unknown>;

    const result = await dotServer.callTool(name, params);

    return {
      content: result.content.map(c => ({
        type: c.type as 'text' | 'image' | 'resource',
        ...(c.text !== undefined ? { text: c.text } : {}),
        ...(c.data !== undefined ? { data: c.data } : {}),
        ...(c.mimeType !== undefined ? { mimeType: c.mimeType } : {}),
      })),
      isError: result.isError ?? false,
    };
  });

  return server;
}

// ---------------------------------------------------------------------------
// startStdioServer — connect to stdio and run
// ---------------------------------------------------------------------------

/**
 * Start the DOT MCP server over stdio.
 *
 * Reads JSON-RPC from process.stdin, writes responses to process.stdout.
 * Intended to be called from a CLI entrypoint.
 *
 * @returns Promise that resolves when the transport is connected.
 */
export async function startStdioServer(): Promise<void> {
  const server = createSdkServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[dot-mcp] stdio server running — 11 tools registered\n');
}
