/**
 * server.ts — DOT MCP server setup.
 *
 * createDotMCPServer() returns a fully-configured MCPServer with all
 * 11 DOT tools registered. The runtime is lazily booted on first tool call.
 *
 * Usage (internal / test):
 *   const server = createDotMCPServer();
 *   await server.callTool('dot_boot', {});
 *
 * Usage (stdio / production):
 *   import { startStdioServer } from './stdio-server.js';
 *   await startStdioServer();
 *
 * @modelcontextprotocol/sdk v1.28.0 is installed. The real stdio transport
 * is wired in stdio-server.ts using the SDK's Server + StdioServerTransport.
 */

import { MCPServer } from './mcp-interface.js';
import {
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
import {
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
  type BootParams,
  type ObserveParams,
  type VerifyParams,
  type SignParams,
  type TrustParams,
  type CompileParams,
  type ExplainParams,
  type ExecuteParams,
  type BridgeParams,
} from './handlers.js';

function typedParams<T>(params: Record<string, unknown>): T {
  return params as unknown as T;
}

/**
 * Create and configure the DOT MCP server.
 *
 * All 11 tools are registered. The runtime is lazily initialised on first
 * call to dot_boot, dot_observe, dot_chain, dot_sign, dot_trust, dot_health,
 * dot_execute, or dot_bridge.
 *
 * @returns A configured MCPServer ready to start.
 */
export function createDotMCPServer(): MCPServer {
  const server = new MCPServer('@dot-protocol/mcp', '1.0.0-alpha.0');

  // 1. dot_boot
  server.registerTool(DOT_BOOT_TOOL, async (params) =>
    handleBoot(typedParams<BootParams>(params)),
  );

  // 2. dot_observe
  server.registerTool(DOT_OBSERVE_TOOL, async (params) =>
    handleObserve(typedParams<ObserveParams>(params)),
  );

  // 3. dot_verify
  server.registerTool(DOT_VERIFY_TOOL, async (params) =>
    handleVerify(typedParams<VerifyParams>(params)),
  );

  // 4. dot_chain
  server.registerTool(DOT_CHAIN_TOOL, async (params) =>
    handleChain(params as Record<string, unknown>),
  );

  // 5. dot_sign
  server.registerTool(DOT_SIGN_TOOL, async (params) =>
    handleSign(typedParams<SignParams>(params)),
  );

  // 6. dot_trust
  server.registerTool(DOT_TRUST_TOOL, async (params) =>
    handleTrust(typedParams<TrustParams>(params)),
  );

  // 7. dot_compile
  server.registerTool(DOT_COMPILE_TOOL, async (params) =>
    handleCompile(typedParams<CompileParams>(params)),
  );

  // 8. dot_explain
  server.registerTool(DOT_EXPLAIN_TOOL, async (params) =>
    handleExplain(typedParams<ExplainParams>(params)),
  );

  // 9. dot_health
  server.registerTool(DOT_HEALTH_TOOL, async (params) =>
    handleHealth(params as Record<string, unknown>),
  );

  // 10. dot_execute
  server.registerTool(DOT_EXECUTE_TOOL, async (params) =>
    handleExecute(typedParams<ExecuteParams>(params)),
  );

  // 11. dot_bridge
  server.registerTool(DOT_BRIDGE_TOOL, async (params) =>
    handleBridge(typedParams<BridgeParams>(params)),
  );

  return server;
}
