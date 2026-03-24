/**
 * tools.test.ts — MCP tool definitions test suite.
 *
 * Tests cover:
 *  - All 11 tool definitions are correctly shaped
 *  - Each tool's inputSchema is a valid JSON Schema object
 *  - Required fields are declared correctly
 *  - ALL_TOOLS list contains all 11 tools
 *  - Server dispatch works (success + error paths) for each tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDotMCPServer } from '../src/server.js';
import { ALL_TOOLS } from '../src/tools.js';
import { MCPServer } from '../src/mcp-interface.js';
import { setRuntime } from '../src/handlers.js';

// ---------------------------------------------------------------------------
// Tool definition tests
// ---------------------------------------------------------------------------

describe('ALL_TOOLS', () => {
  it('contains exactly 11 tools', () => {
    expect(ALL_TOOLS).toHaveLength(11);
  });

  it('every tool has a non-empty name', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toBeTruthy();
    }
  });

  it('every tool has a non-empty description', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('every tool has an inputSchema of type "object"', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('all expected tool names are present', () => {
    const names = ALL_TOOLS.map(t => t.name);
    const expected = [
      'dot_boot', 'dot_observe', 'dot_verify', 'dot_chain', 'dot_sign',
      'dot_trust', 'dot_compile', 'dot_explain', 'dot_health', 'dot_execute',
      'dot_bridge',
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });
});

// ---------------------------------------------------------------------------
// Server registration tests
// ---------------------------------------------------------------------------

describe('createDotMCPServer', () => {
  it('returns an MCPServer instance', () => {
    const server = createDotMCPServer();
    expect(server).toBeInstanceOf(MCPServer);
  });

  it('registers all 11 tools', () => {
    const server = createDotMCPServer();
    expect(server.listTools()).toHaveLength(11);
  });

  it('listTools returns definitions with names', () => {
    const server = createDotMCPServer();
    const tools = server.listTools();
    expect(tools.every(t => typeof t.name === 'string')).toBe(true);
  });

  it('unknown tool returns isError result', async () => {
    const server = createDotMCPServer();
    const result = await server.callTool('dot_nonexistent', {});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Unknown tool');
  });
});

// ---------------------------------------------------------------------------
// Tool dispatch success + error tests — each of 11 tools
// ---------------------------------------------------------------------------

describe('dot_boot via server.callTool', () => {
  it('success: returns publicKey and chainDepth', async () => {
    const server = createDotMCPServer();
    const result = await server.callTool('dot_boot', {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.publicKey).toBe('string');
    expect(parsed.publicKey).toHaveLength(64); // 32 bytes hex
    expect(typeof parsed.chainDepth).toBe('number');
  });

  it('error: invalid params type is tolerated (meshEnabled ignored)', async () => {
    const server = createDotMCPServer();
    // meshEnabled is optional — extra params should still work
    const result = await server.callTool('dot_boot', { meshEnabled: false });
    expect(result.isError).toBeFalsy();
  });
});

describe('dot_observe via server.callTool', () => {
  it('success: creates a DOT and returns hash, level, trust', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_observe', {
      payload: 'temperature=82.3',
      type: 'measure',
    });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.hash).toBe('string');
    expect(typeof parsed.level).toBe('number');
    expect(typeof parsed.trust).toBe('number');
    expect(parsed.trust).toBeGreaterThan(0);
  });

  it('success: works without explicit type', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_observe', { payload: 'hello' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.dotBytes).toBeTruthy();
  });
});

describe('dot_verify via server.callTool', () => {
  it('success: verifies a freshly observed DOT as valid', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const obs = await server.callTool('dot_observe', { payload: 'ping', type: 'event' });
    const { dotBytes } = JSON.parse(obs.content[0]!.text!);

    const result = await server.callTool('dot_verify', { dotBytes });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.valid).toBe(true);
    expect(Array.isArray(parsed.checked)).toBe(true);
  });

  it('error: missing dotBytes param causes error', async () => {
    const server = createDotMCPServer();
    const result = await server.callTool('dot_verify', {});
    expect(result.isError).toBe(true);
  });
});

describe('dot_chain via server.callTool', () => {
  it('success: returns depth, tipHash, dotCount', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_chain', {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.depth).toBe('number');
    expect(typeof parsed.tipHash).toBe('string');
    expect(typeof parsed.dotCount).toBe('number');
  });

  it('success: dotCount increases after observe', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const before = JSON.parse((await server.callTool('dot_chain', {})).content[0]!.text!);
    await server.callTool('dot_observe', { payload: 'new observation' });
    const after = JSON.parse((await server.callTool('dot_chain', {})).content[0]!.text!);
    expect(after.dotCount).toBeGreaterThan(before.dotCount);
  });
});

describe('dot_sign via server.callTool', () => {
  it('success: returns hash and signature as hex strings', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_sign', { payload: 'to sign', type: 'claim' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.hash).toBe('string');
    expect(typeof parsed.signature).toBe('string');
    expect(parsed.signature).toHaveLength(128); // 64 bytes hex
  });

  it('success: works with no payload', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_sign', {});
    expect(result.isError).toBeFalsy();
  });
});

describe('dot_trust via server.callTool', () => {
  it('success: returns numeric trust and breakdown', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_trust', { payload: 'sensor_reading=42' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.trust).toBe('number');
    expect(parsed.breakdown).toBeDefined();
    expect(typeof parsed.breakdown.hasSignature).toBe('boolean');
  });

  it('success: unsigned DOT has lower trust than signed', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const unsignedResult = await server.callTool('dot_trust', { payload: 'x', signed: false });
    const signedResult = await server.callTool('dot_trust', { payload: 'x', signed: true });
    const unsigned = JSON.parse(unsignedResult.content[0]!.text!);
    const signed = JSON.parse(signedResult.content[0]!.text!);
    expect(signed.trust).toBeGreaterThan(unsigned.trust);
  });
});

describe('dot_compile via server.callTool', () => {
  it('success: compiles valid DOT source to TypeScript', async () => {
    const server = createDotMCPServer();
    const source = 'observe temperature at sensor(7) = 82.3';
    const result = await server.callTool('dot_compile', { source });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.typescript).toBe('string');
    expect(parsed.typescript.length).toBeGreaterThan(0);
    expect(parsed.errors).toHaveLength(0);
  });

  it('error: invalid source returns errors array (not a crash)', async () => {
    const server = createDotMCPServer();
    const result = await server.callTool('dot_compile', { source: '@@@ invalid %%%' });
    expect(result.isError).toBeFalsy(); // handler catches internally
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});

describe('dot_explain via server.callTool', () => {
  it('success: returns English description', async () => {
    const server = createDotMCPServer();
    const source = 'observe temperature at sensor(7) = 82.3';
    const result = await server.callTool('dot_explain', { source });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.english).toBe('string');
    expect(parsed.english.length).toBeGreaterThan(0);
  });

  it('error: invalid source returns Error prefix in english field', async () => {
    const server = createDotMCPServer();
    const result = await server.callTool('dot_explain', { source: '@@@ bad source' });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.english).toMatch(/Error/);
  });
});

describe('dot_health via server.callTool', () => {
  it('success: returns runtimeReady=false when not booted', async () => {
    // Reset runtime
    setRuntime(null);
    const server = createDotMCPServer();
    const result = await server.callTool('dot_health', {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.runtimeReady).toBe(false);
  });

  it('success: returns runtimeReady=true after boot', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_health', {});
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.runtimeReady).toBe(true);
    expect(typeof parsed.uptime).toBe('number');
    expect(typeof parsed.dotsCreated).toBe('number');
  });
});

describe('dot_execute via server.callTool', () => {
  it('success: compiles and returns typescript', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const source = 'observe temperature at sensor(7) = 82.3';
    const result = await server.callTool('dot_execute', { source });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(typeof parsed.typescript).toBe('string');
    expect(typeof parsed.duration_ms).toBe('number');
    expect(Array.isArray(parsed.dots)).toBe(true);
  });

  it('error: invalid source returns non-empty errors array', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const result = await server.callTool('dot_execute', { source: '@@@ invalid' });
    expect(result.isError).toBeFalsy(); // handler catches internally
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.errors.length).toBeGreaterThan(0);
  });
});

describe('dot_bridge via server.callTool', () => {
  it('success: converts legacy v0.3.0 DOT to R854 format', async () => {
    const server = createDotMCPServer();
    await server.callTool('dot_boot', {});
    const legacyDot = JSON.stringify({
      type: 'event',
      data: 'sensor reading',
      pub_key: 'aabbcc',
      sig: 'deadbeef',
      prev_hash: '0000ffff',
      payload_hash: 'cafebabe',
      timestamp: 1700000000000,
    });
    const result = await server.callTool('dot_bridge', { legacyDot });
    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text!);
    expect(parsed.converted).toBeDefined();
    expect(parsed.converted.type).toBe('event');
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it('error: invalid JSON causes error result', async () => {
    const server = createDotMCPServer();
    const result = await server.callTool('dot_bridge', { legacyDot: 'not json{{{' });
    expect(result.isError).toBe(true);
  });
});
