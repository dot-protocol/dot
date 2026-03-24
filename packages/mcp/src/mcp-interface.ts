/**
 * mcp-interface.ts — Minimal MCP (Model Context Protocol) interface.
 *
 * NOTE: @modelcontextprotocol/sdk is not installed. This file defines the
 * minimal interface shapes needed for the DOT MCP server. When the real SDK
 * is available, replace the import in server.ts with:
 *   import { Server, StdioServerTransport } from '@modelcontextprotocol/sdk/server/index.js';
 *
 * The tool handler signatures match MCP SDK v1.x patterns.
 */

/** JSON Schema subset used for tool input schemas. */
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
  additionalProperties?: boolean;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  enum?: string[];
}

/** A single MCP tool definition. */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

/** Handler function type: receives typed params, returns a result or throws. */
export type ToolHandler<TParams = Record<string, unknown>, TResult = unknown> = (
  params: TParams,
) => Promise<TResult>;

/** A registered tool — definition + handler. */
export interface RegisteredTool {
  definition: MCPToolDefinition;
  handler: ToolHandler;
}

/** MCP server content item (text, image, or resource). */
export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

/** Standard MCP tool call result. */
export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

/**
 * Minimal MCPServer implementation.
 *
 * A real MCP server uses stdio transport and the JSON-RPC 2.0 protocol.
 * This class provides the same tool registration and dispatch API so
 * handlers are fully testable without the real SDK.
 *
 * To wire into a real MCP host, replace the start() body with:
 *   const transport = new StdioServerTransport();
 *   await this._server.connect(transport);
 */
export class MCPServer {
  readonly name: string;
  readonly version: string;
  private readonly _tools = new Map<string, RegisteredTool>();

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }

  /** Register a tool definition + handler. Overwrites if name already registered. */
  registerTool(definition: MCPToolDefinition, handler: ToolHandler): void {
    this._tools.set(definition.name, { definition, handler });
  }

  /** List all registered tool definitions (for MCP tool listing). */
  listTools(): MCPToolDefinition[] {
    return Array.from(this._tools.values()).map(t => t.definition);
  }

  /**
   * Dispatch a tool call by name.
   *
   * Returns an MCPToolResult with JSON-stringified result on success,
   * or an error MCPToolResult if the tool throws.
   */
  async callTool(name: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    const registered = this._tools.get(name);
    if (!registered) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const result = await registered.handler(params);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Tool error: ${message}` }],
        isError: true,
      };
    }
  }

  /**
   * Start the MCP server.
   *
   * With the real SDK this would connect stdio transport. Here it is a no-op
   * that prints a notice — suitable for testing and local use.
   */
  async start(): Promise<void> {
    // NOTE: Replace with real SDK transport when @modelcontextprotocol/sdk is available:
    //   const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    //   const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    //   const transport = new StdioServerTransport();
    //   await this._sdkServer.connect(transport);
    process.stderr.write(
      `[dot-mcp] Server "${this.name}" v${this.version} ready — ${this._tools.size} tools registered.\n`,
    );
  }
}
