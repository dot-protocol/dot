/**
 * @dot-protocol/mcp — DOT Protocol MCP Server.
 *
 * Exposes the full DOT Protocol surface via 11 MCP tools:
 *   dot_boot, dot_observe, dot_verify, dot_chain, dot_sign,
 *   dot_trust, dot_compile, dot_explain, dot_health, dot_execute, dot_bridge
 *
 * NOTE: @modelcontextprotocol/sdk is not installed. A minimal mock interface
 * is provided in mcp-interface.ts. To use the real SDK, replace MCPServer
 * with the real Server class and connect a StdioServerTransport.
 *
 * Usage:
 *   import { createDotMCPServer } from '@dot-protocol/mcp';
 *   const server = createDotMCPServer();
 *   await server.start();
 */

// Server factory
export { createDotMCPServer } from './server.js';

// MCP interface (mock — replace with real SDK types when available)
export { MCPServer } from './mcp-interface.js';
export type {
  MCPToolDefinition,
  MCPToolResult,
  MCPContent,
  ToolHandler,
  RegisteredTool,
  JSONSchema,
} from './mcp-interface.js';

// Tool definitions
export { ALL_TOOLS } from './tools.js';
export {
  DOT_BOOT_TOOL,
  DOT_OBSERVE_TOOL,
  DOT_VERIFY_TOOL,
  DOT_CHAIN_TOOL,
  DOT_SIGN_TOOL,
  DOT_TRUST_TOOL,
  DOT_COMPILE_TOOL,
  DOT_EXPLAIN_TOOL,
  DOT_HEALTH_TOOL,
  DOT_EXECUTE_TOOL,
  DOT_BRIDGE_TOOL,
} from './tools.js';

// Handlers (exported for direct use and testing)
export {
  handleBoot,
  handleObserve,
  handleVerify,
  handleChain,
  handleSign,
  handleTrust,
  handleCompile,
  handleExplain,
  handleHealth,
  handleExecute,
  handleBridge,
  getRuntimeOrNull,
  setRuntime,
} from './handlers.js';

export type {
  BootParams,
  BootResult,
  ObserveParams,
  ObserveResult,
  VerifyParams,
  VerifyResult,
  ChainResult,
  SignParams,
  SignResult,
  TrustParams,
  TrustResult,
  CompileParams,
  CompileResult,
  ExplainParams,
  ExplainResult,
  HealthResult,
  ExecuteParams,
  ExecuteResult,
  BridgeParams,
  BridgeResult,
} from './handlers.js';
