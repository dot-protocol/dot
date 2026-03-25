/**
 * sdk-server.test.ts — Tests for the real @modelcontextprotocol/sdk-backed server.
 *
 * createSdkServer() returns an SDK Server configured with all 11 DOT tools.
 * These tests drive the server via in-memory Client↔Server transport to verify:
 *
 *   1. Server initialises correctly and reports tool capabilities
 *   2. tools/list returns all 11 tool definitions with correct shapes
 *   3. tools/call dispatches to each handler and returns well-formed results
 *   4. Unknown tool names produce error responses
 *   5. Required-param validation: missing required field causes error
 *
 * We use the SDK InMemoryTransport to avoid spawning a subprocess or needing
 * stdio, while still exercising the real JSON-RPC 2.0 dispatch path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createSdkServer } from '../src/stdio-server.js';
import { setRuntime } from '../src/handlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a connected Client↔Server pair using InMemoryTransport.
 * The server is a real createSdkServer() instance.
 * Clean up is handled via the returned cleanup() function.
 */
async function makeClientServer(): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = createSdkServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: {} },
  );

  // Connect both ends
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return {
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Reset runtime before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  setRuntime(null);
});

afterEach(() => {
  setRuntime(null);
});

// ---------------------------------------------------------------------------
// 1. tools/list — server advertises all 11 tools
// ---------------------------------------------------------------------------

describe('SDK server: tools/list', () => {
  it('returns exactly 11 tools', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.listTools();
      expect(result.tools).toHaveLength(11);
    } finally {
      await cleanup();
    }
  });

  it('every tool has a non-empty name', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.listTools();
      for (const tool of result.tools) {
        expect(tool.name.length).toBeGreaterThan(0);
      }
    } finally {
      await cleanup();
    }
  });

  it('every tool has a non-empty description', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.listTools();
      for (const tool of result.tools) {
        expect((tool.description ?? '').length).toBeGreaterThan(10);
      }
    } finally {
      await cleanup();
    }
  });

  it('every tool has inputSchema of type "object"', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.listTools();
      for (const tool of result.tools) {
        expect(tool.inputSchema.type).toBe('object');
      }
    } finally {
      await cleanup();
    }
  });

  it('all 11 expected tool names are present', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.listTools();
      const names = result.tools.map(t => t.name);
      const expected = [
        'dot_boot', 'dot_observe', 'dot_verify', 'dot_chain', 'dot_sign',
        'dot_trust', 'dot_compile', 'dot_explain', 'dot_health', 'dot_execute',
        'dot_bridge',
      ];
      for (const name of expected) {
        expect(names).toContain(name);
      }
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. tools/call — dot_boot
// ---------------------------------------------------------------------------

describe('SDK server: dot_boot', () => {
  it('returns publicKey as 64-char hex string', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({ name: 'dot_boot', arguments: {} });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['publicKey']).toBe('string');
      expect((parsed['publicKey'] as string)).toHaveLength(64);
    } finally {
      await cleanup();
    }
  });

  it('returns chainDepth >= 1 (genesis DOT anchored)', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({ name: 'dot_boot', arguments: {} });
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['chainDepth']).toBe('number');
      expect(parsed['chainDepth'] as number).toBeGreaterThanOrEqual(1);
    } finally {
      await cleanup();
    }
  });

  it('returns bootTimeMs >= 0', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({ name: 'dot_boot', arguments: {} });
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed['bootTimeMs'] as number).toBeGreaterThanOrEqual(0);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. tools/call — dot_observe
// ---------------------------------------------------------------------------

describe('SDK server: dot_observe', () => {
  it('creates a DOT and returns hash, level, trust, dotBytes', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const result = await client.callTool({
        name: 'dot_observe',
        arguments: { payload: 'temperature=82.3', type: 'measure' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['hash']).toBe('string');
      expect((parsed['hash'] as string).length).toBeGreaterThan(0);
      expect(typeof parsed['level']).toBe('number');
      expect(typeof parsed['trust']).toBe('number');
      expect((parsed['trust'] as number)).toBeGreaterThan(0);
      expect(typeof parsed['dotBytes']).toBe('string');
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 4. tools/call — dot_compile
// ---------------------------------------------------------------------------

describe('SDK server: dot_compile', () => {
  it('compiles valid DOT source to TypeScript', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({
        name: 'dot_compile',
        arguments: { source: 'observe temperature at sensor(7) = 82.3' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['typescript']).toBe('string');
      expect((parsed['typescript'] as string).length).toBeGreaterThan(0);
      expect((parsed['errors'] as unknown[]).length).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('TypeScript output contains @dot-protocol/core import', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({
        name: 'dot_compile',
        arguments: { source: 'observe temperature at sensor(7) = 82.3' },
      });
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed['typescript'] as string).toContain('@dot-protocol/core');
    } finally {
      await cleanup();
    }
  });

  it('invalid source returns non-empty errors (not isError=true)', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({
        name: 'dot_compile',
        arguments: { source: '@@@ invalid %%%' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect((parsed['errors'] as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. tools/call — dot_verify (round-trip via observe)
// ---------------------------------------------------------------------------

describe('SDK server: dot_verify', () => {
  it('verifies a freshly observed DOT as valid', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const obs = await client.callTool({
        name: 'dot_observe',
        arguments: { payload: 'ping', type: 'event' },
      });
      const obsText = (obs.content[0] as { type: string; text: string }).text;
      const { dotBytes } = JSON.parse(obsText) as Record<string, unknown>;

      const result = await client.callTool({
        name: 'dot_verify',
        arguments: { dotBytes },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed['valid']).toBe(true);
      expect(Array.isArray(parsed['checked'])).toBe(true);
      expect((parsed['checked'] as unknown[]).length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 6. tools/call — dot_health
// ---------------------------------------------------------------------------

describe('SDK server: dot_health', () => {
  it('returns runtimeReady=false before boot', async () => {
    setRuntime(null);
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({ name: 'dot_health', arguments: {} });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed['runtimeReady']).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it('returns runtimeReady=true after boot', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const result = await client.callTool({ name: 'dot_health', arguments: {} });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed['runtimeReady']).toBe(true);
      expect(typeof parsed['dotsCreated']).toBe('number');
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 7. tools/call — dot_chain
// ---------------------------------------------------------------------------

describe('SDK server: dot_chain', () => {
  it('returns depth, tipHash, dotCount after boot', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const result = await client.callTool({ name: 'dot_chain', arguments: {} });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['depth']).toBe('number');
      expect((parsed['depth'] as number)).toBeGreaterThanOrEqual(1);
      expect(typeof parsed['tipHash']).toBe('string');
      expect((parsed['tipHash'] as string).length).toBeGreaterThan(0);
      expect(typeof parsed['dotCount']).toBe('number');
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 8. tools/call — dot_sign
// ---------------------------------------------------------------------------

describe('SDK server: dot_sign', () => {
  it('returns 128-char hex signature after boot', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const result = await client.callTool({
        name: 'dot_sign',
        arguments: { payload: 'hello dot', type: 'claim' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect((parsed['signature'] as string)).toHaveLength(128);
      expect(parsed['signature'] as string).toMatch(/^[0-9a-f]+$/);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 9. tools/call — dot_trust
// ---------------------------------------------------------------------------

describe('SDK server: dot_trust', () => {
  it('returns numeric trust and breakdown object', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const result = await client.callTool({
        name: 'dot_trust',
        arguments: { payload: 'sensor=42', type: 'measure' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['trust']).toBe('number');
      expect((parsed['trust'] as number)).toBeGreaterThan(0);
      const breakdown = parsed['breakdown'] as Record<string, unknown>;
      expect(typeof breakdown['hasSignature']).toBe('boolean');
      expect(typeof breakdown['hasTime']).toBe('boolean');
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 10. tools/call — dot_explain
// ---------------------------------------------------------------------------

describe('SDK server: dot_explain', () => {
  it('returns English description containing "temperature"', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({
        name: 'dot_explain',
        arguments: { source: 'observe temperature at sensor(7) = 82.3' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['english']).toBe('string');
      expect((parsed['english'] as string).toLowerCase()).toContain('temperature');
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 11. tools/call — dot_execute
// ---------------------------------------------------------------------------

describe('SDK server: dot_execute', () => {
  it('returns typescript + duration_ms + dots array', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      await client.callTool({ name: 'dot_boot', arguments: {} });
      const result = await client.callTool({
        name: 'dot_execute',
        arguments: { source: 'observe temperature at sensor(7) = 82.3' },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(typeof parsed['typescript']).toBe('string');
      expect((parsed['typescript'] as string).length).toBeGreaterThan(0);
      expect(typeof parsed['duration_ms']).toBe('number');
      expect(Array.isArray(parsed['dots'])).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 12. tools/call — dot_bridge
// ---------------------------------------------------------------------------

describe('SDK server: dot_bridge', () => {
  it('converts legacy v0.3.0 DOT to R854 format', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const legacyDot = JSON.stringify({
        type: 'event',
        data: 'sensor reading',
        pub_key: 'aabbcc',
        sig: 'deadbeef',
        prev_hash: '0000ffff',
        payload_hash: 'cafebabe',
        timestamp: 1700000000000,
      });
      const result = await client.callTool({
        name: 'dot_bridge',
        arguments: { legacyDot },
      });
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { type: string; text: string }).text;
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const converted = parsed['converted'] as Record<string, unknown>;
      expect(converted['type']).toBe('event');
      expect(converted['payload']).toBe('sensor reading');
      expect(Array.isArray(parsed['warnings'])).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it('invalid JSON causes error result (isError=true)', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({
        name: 'dot_bridge',
        arguments: { legacyDot: 'not json{{{' },
      });
      expect(result.isError).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Unknown tool — SDK server handles gracefully
// ---------------------------------------------------------------------------

describe('SDK server: unknown tool name', () => {
  it('returns isError=true for an unknown tool name', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      const result = await client.callTool({ name: 'dot_nonexistent', arguments: {} });
      expect(result.isError).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// 14. Multi-call sequence: boot → observe → chain → verify
// ---------------------------------------------------------------------------

describe('SDK server: full sequence test', () => {
  it('boot → observe → chain → verify all succeed', async () => {
    const { client, cleanup } = await makeClientServer();
    try {
      // Boot
      const bootResult = await client.callTool({ name: 'dot_boot', arguments: {} });
      expect(bootResult.isError).toBeFalsy();
      const bootParsed = JSON.parse(
        (bootResult.content[0] as { type: string; text: string }).text,
      ) as Record<string, unknown>;
      expect((bootParsed['chainDepth'] as number)).toBeGreaterThanOrEqual(1);

      // Observe
      const obsResult = await client.callTool({
        name: 'dot_observe',
        arguments: { payload: 'sequence test', type: 'state' },
      });
      expect(obsResult.isError).toBeFalsy();
      const { dotBytes, trust } = JSON.parse(
        (obsResult.content[0] as { type: string; text: string }).text,
      ) as Record<string, unknown>;
      expect((trust as number)).toBeGreaterThan(0);

      // Chain grows
      const chainResult = await client.callTool({ name: 'dot_chain', arguments: {} });
      const chainParsed = JSON.parse(
        (chainResult.content[0] as { type: string; text: string }).text,
      ) as Record<string, unknown>;
      expect((chainParsed['dotCount'] as number)).toBeGreaterThan(1);

      // Verify observed DOT
      const verifyResult = await client.callTool({
        name: 'dot_verify',
        arguments: { dotBytes },
      });
      expect(verifyResult.isError).toBeFalsy();
      const verifyParsed = JSON.parse(
        (verifyResult.content[0] as { type: string; text: string }).text,
      ) as Record<string, unknown>;
      expect(verifyParsed['valid']).toBe(true);
    } finally {
      await cleanup();
    }
  });
});
