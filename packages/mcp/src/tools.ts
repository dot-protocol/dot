/**
 * tools.ts — DOT MCP tool definitions.
 *
 * 11 tools covering the full DOT Protocol surface:
 *   dot_boot, dot_observe, dot_verify, dot_chain, dot_sign,
 *   dot_trust, dot_compile, dot_explain, dot_health, dot_execute, dot_bridge
 *
 * Each tool has: name, description, inputSchema (JSON Schema), and a handler
 * factory function. Handlers are wired in handlers.ts.
 */

import type { MCPToolDefinition } from './mcp-interface.js';

// ---------------------------------------------------------------------------
// Tool definitions (name + description + inputSchema)
// ---------------------------------------------------------------------------

export const DOT_BOOT_TOOL: MCPToolDefinition = {
  name: 'dot_boot',
  description:
    'Boot the DOT runtime. Creates a fresh Ed25519 identity, anchors a genesis DOT on the ' +
    'identity chain, and returns the public key and initial chain depth. ' +
    'Must be called before any other tool that requires a runtime.',
  inputSchema: {
    type: 'object',
    properties: {
      meshEnabled: {
        type: 'boolean',
        description: 'Whether to enable mesh networking. Defaults to false.',
      },
    },
    additionalProperties: false,
  },
};

export const DOT_OBSERVE_TOOL: MCPToolDefinition = {
  name: 'dot_observe',
  description:
    'Create a signed, chained DOT observation. ' +
    'Calls observe → chain → sign in the correct order and appends to the identity chain. ' +
    'Returns the hash, level, and trust score of the resulting DOT.',
  inputSchema: {
    type: 'object',
    properties: {
      payload: {
        type: 'string',
        description: 'The value to observe (string, JSON, or numeric string).',
      },
      type: {
        type: 'string',
        description: 'Observation type: measure | state | event | claim | bond.',
        enum: ['measure', 'state', 'event', 'claim', 'bond'],
      },
      plaintext: {
        type: 'boolean',
        description: 'Store payload as plaintext instead of FHE. Defaults to false.',
      },
    },
    additionalProperties: false,
  },
};

export const DOT_VERIFY_TOOL: MCPToolDefinition = {
  name: 'dot_verify',
  description:
    'Verify the integrity of a serialised DOT (base64-encoded CBOR bytes). ' +
    'Checks Ed25519 signature (if present), BLAKE3 payload hash (if present), ' +
    'and chain link structure. Returns validity flag, checks performed, and an ' +
    'optional reason string.',
  inputSchema: {
    type: 'object',
    properties: {
      dotBytes: {
        type: 'string',
        description:
          'Base64-encoded CBOR bytes of the DOT to verify. ' +
          'Obtain from a previous dot_observe or dot_sign call.',
      },
    },
    required: ['dotBytes'],
    additionalProperties: false,
  },
};

export const DOT_CHAIN_TOOL: MCPToolDefinition = {
  name: 'dot_chain',
  description:
    'Get the current state of the runtime identity chain. ' +
    'Returns the chain depth, tip hash (hex), and total DOT count.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export const DOT_SIGN_TOOL: MCPToolDefinition = {
  name: 'dot_sign',
  description:
    'Sign an existing unsigned DOT using the runtime identity. ' +
    'Accepts a JSON representation of the DOT fields and returns the ' +
    'hash and signature (both as hex strings).',
  inputSchema: {
    type: 'object',
    properties: {
      payload: {
        type: 'string',
        description: 'String payload to sign as a new DOT.',
      },
      type: {
        type: 'string',
        description: 'Observation type for the DOT.',
        enum: ['measure', 'state', 'event', 'claim', 'bond'],
      },
    },
    additionalProperties: false,
  },
};

export const DOT_TRUST_TOOL: MCPToolDefinition = {
  name: 'dot_trust',
  description:
    'Compute the trust score for a DOT (0.0 to ~3.0+). ' +
    'Trust is computed from STCV base presence, FHE bonus, identity level, ' +
    'and chain depth multiplier. Returns numeric trust and a breakdown object.',
  inputSchema: {
    type: 'object',
    properties: {
      payload: {
        type: 'string',
        description: 'String payload to observe and score.',
      },
      type: {
        type: 'string',
        description: 'Observation type for the DOT.',
        enum: ['measure', 'state', 'event', 'claim', 'bond'],
      },
      signed: {
        type: 'boolean',
        description: 'Whether to sign the DOT before scoring (increases trust). Defaults to true.',
      },
    },
    additionalProperties: false,
  },
};

export const DOT_COMPILE_TOOL: MCPToolDefinition = {
  name: 'dot_compile',
  description:
    'Compile DOT language source code to TypeScript. ' +
    'Runs the full pipeline: lex → parse → type-check → generateTypeScript. ' +
    'Returns the generated TypeScript source and any errors.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'DOT language source code to compile.',
      },
    },
    required: ['source'],
    additionalProperties: false,
  },
};

export const DOT_EXPLAIN_TOOL: MCPToolDefinition = {
  name: 'dot_explain',
  description:
    'Explain DOT language source code in plain English. ' +
    'Runs lex → parse → generateEnglish. ' +
    'Returns a human-readable description of what the program does.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'DOT language source code to explain.',
      },
    },
    required: ['source'],
    additionalProperties: false,
  },
};

export const DOT_HEALTH_TOOL: MCPToolDefinition = {
  name: 'dot_health',
  description:
    'Get the health status of the DOT runtime. ' +
    'Returns uptime in milliseconds, total DOTs created, and active chain count.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

export const DOT_EXECUTE_TOOL: MCPToolDefinition = {
  name: 'dot_execute',
  description:
    'Execute a .dot program from source. ' +
    'Compiles the source to TypeScript, then evaluates the observation pipeline, ' +
    'emitting real DOTs through the live runtime. ' +
    'Returns the list of DOTs produced (hash, type, trust) and total duration.',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'DOT language source code to execute.',
      },
    },
    required: ['source'],
    additionalProperties: false,
  },
};

export const DOT_BRIDGE_TOOL: MCPToolDefinition = {
  name: 'dot_bridge',
  description:
    'Convert a v0.3.0 DOT (JSON format with legacy fields) to the R854 format. ' +
    'Maps old field names (payload_hash, sig, pub_key, prev_hash) to the new STCV ' +
    'structure. Returns the converted DOT and an optional bridge audit DOT.',
  inputSchema: {
    type: 'object',
    properties: {
      legacyDot: {
        type: 'string',
        description: 'JSON string of the v0.3.0 DOT to convert.',
      },
    },
    required: ['legacyDot'],
    additionalProperties: false,
  },
};

/** All 11 tool definitions in registration order. */
export const ALL_TOOLS: MCPToolDefinition[] = [
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
];
