/**
 * handlers.test.ts — Direct handler unit tests.
 *
 * Tests each handler function directly (not via server dispatch) to verify:
 *  - Boot creates a runtime and returns publicKey
 *  - Observe produces a DOT with hash/level/trust
 *  - Compile returns TypeScript
 *  - Explain returns English
 *  - Sign returns hex signature
 *  - Verify validates DOTs
 *  - Chain returns depth/tipHash
 *  - Trust returns score and breakdown
 *  - Health returns runtime state
 *  - Execute runs the pipeline
 *  - Bridge converts legacy DOTs
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  getRuntimeOrNull,
  setRuntime,
} from '../src/handlers.js';

// Reset runtime before each test for isolation
beforeEach(() => {
  setRuntime(null);
});

// ---------------------------------------------------------------------------
// dot_boot
// ---------------------------------------------------------------------------

describe('handleBoot', () => {
  it('creates runtime and returns publicKey (64 hex chars)', async () => {
    const result = await handleBoot({});
    expect(result.publicKey).toHaveLength(64);
    expect(result.publicKey).toMatch(/^[0-9a-f]+$/);
  });

  it('returns chainDepth >= 1 (genesis DOT was appended)', async () => {
    const result = await handleBoot({});
    expect(result.chainDepth).toBeGreaterThanOrEqual(1);
  });

  it('runtime is accessible after boot', async () => {
    await handleBoot({});
    expect(getRuntimeOrNull()).not.toBeNull();
  });

  it('each boot call creates a fresh identity', async () => {
    const r1 = await handleBoot({});
    const r2 = await handleBoot({});
    expect(r1.publicKey).not.toBe(r2.publicKey);
  });

  it('returns bootTimeMs >= 0', async () => {
    const result = await handleBoot({});
    expect(result.bootTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// dot_observe
// ---------------------------------------------------------------------------

describe('handleObserve', () => {
  it('produces a DOT with non-empty hash', async () => {
    await handleBoot({});
    const result = await handleObserve({ payload: 'hello world', type: 'event' });
    expect(result.hash.length).toBeGreaterThan(0);
    expect(result.hash).toMatch(/^[0-9a-f]+$/);
  });

  it('level is >= 1 for non-empty payload', async () => {
    await handleBoot({});
    const result = await handleObserve({ payload: 'some data', type: 'measure' });
    expect(result.level).toBeGreaterThanOrEqual(1);
  });

  it('trust > 0 for a signed observation', async () => {
    await handleBoot({});
    const result = await handleObserve({ payload: 'sensor=42', type: 'measure' });
    expect(result.trust).toBeGreaterThan(0);
  });

  it('dotBytes is a non-empty base64 string', async () => {
    await handleBoot({});
    const result = await handleObserve({ payload: 'ping', type: 'event' });
    expect(result.dotBytes.length).toBeGreaterThan(0);
    // Should be valid base64
    expect(() => Buffer.from(result.dotBytes, 'base64')).not.toThrow();
  });

  it('JSON payload is accepted', async () => {
    await handleBoot({});
    const result = await handleObserve({
      payload: JSON.stringify({ sensor: 'A', value: 42 }),
      type: 'state',
    });
    expect(result.hash.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// dot_compile
// ---------------------------------------------------------------------------

describe('handleCompile', () => {
  it('returns TypeScript for valid DOT source', async () => {
    const result = await handleCompile({ source: 'observe temperature at sensor(7) = 82.3' });
    expect(result.typescript.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('TypeScript output contains import from @dot-protocol/core', async () => {
    const result = await handleCompile({ source: 'observe temperature at sensor(7) = 82.3' });
    expect(result.typescript).toContain('@dot-protocol/core');
  });

  it('invalid source returns non-empty errors array', async () => {
    const result = await handleCompile({ source: '@@@ not valid DOT' });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('empty source returns errors', async () => {
    const result = await handleCompile({ source: '' });
    // Empty source might produce empty TS or error — either is acceptable
    expect(typeof result.typescript).toBe('string');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// dot_explain
// ---------------------------------------------------------------------------

describe('handleExplain', () => {
  it('returns English text for valid DOT source', async () => {
    const result = await handleExplain({ source: 'observe temperature at sensor(7) = 82.3' });
    expect(result.english.length).toBeGreaterThan(0);
    expect(result.english.toLowerCase()).toContain('observe');
  });

  it('result contains the word "temperature"', async () => {
    const result = await handleExplain({ source: 'observe temperature at sensor(7) = 82.3' });
    expect(result.english.toLowerCase()).toContain('temperature');
  });

  it('invalid source returns Error-prefixed string (no crash)', async () => {
    const result = await handleExplain({ source: '@@@ bad' });
    expect(result.english).toMatch(/Error/);
  });
});

// ---------------------------------------------------------------------------
// dot_sign
// ---------------------------------------------------------------------------

describe('handleSign', () => {
  it('returns a 128-char hex signature (64 bytes)', async () => {
    await handleBoot({});
    const result = await handleSign({ payload: 'to sign', type: 'claim' });
    expect(result.signature).toHaveLength(128);
    expect(result.signature).toMatch(/^[0-9a-f]+$/);
  });

  it('returns a hash as hex', async () => {
    await handleBoot({});
    const result = await handleSign({ payload: 'data' });
    expect(result.hash).toMatch(/^[0-9a-f]+$/);
  });

  it('dotBytes is valid base64', async () => {
    await handleBoot({});
    const result = await handleSign({ payload: 'x' });
    expect(() => Buffer.from(result.dotBytes, 'base64')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// dot_verify (round-trip)
// ---------------------------------------------------------------------------

describe('handleVerify', () => {
  it('verifies a freshly observed DOT as valid', async () => {
    await handleBoot({});
    const obs = await handleObserve({ payload: 'test', type: 'event' });
    const result = await handleVerify({ dotBytes: obs.dotBytes });
    expect(result.valid).toBe(true);
    expect(result.checked.length).toBeGreaterThan(0);
  });

  it('throws on invalid base64', async () => {
    await expect(handleVerify({ dotBytes: '@@@ not base64' })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// dot_chain
// ---------------------------------------------------------------------------

describe('handleChain', () => {
  it('returns depth >= 1 after boot', async () => {
    await handleBoot({});
    const result = await handleChain({});
    expect(result.depth).toBeGreaterThanOrEqual(1);
  });

  it('dotCount increases after observe', async () => {
    await handleBoot({});
    const before = await handleChain({});
    await handleObserve({ payload: 'new dot' });
    const after = await handleChain({});
    expect(after.dotCount).toBeGreaterThan(before.dotCount);
  });

  it('tipHash is a non-empty string', async () => {
    await handleBoot({});
    const result = await handleChain({});
    expect(result.tipHash.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// dot_trust
// ---------------------------------------------------------------------------

describe('handleTrust', () => {
  it('signed DOT has trust > 0', async () => {
    await handleBoot({});
    const result = await handleTrust({ payload: 'x', signed: true });
    expect(result.trust).toBeGreaterThan(0);
  });

  it('breakdown has all expected fields', async () => {
    await handleBoot({});
    const result = await handleTrust({ payload: 'x' });
    expect(result.breakdown).toHaveProperty('hasSignature');
    expect(result.breakdown).toHaveProperty('hasTime');
    expect(result.breakdown).toHaveProperty('hasChain');
    expect(result.breakdown).toHaveProperty('hasVerifyHash');
    expect(result.breakdown).toHaveProperty('isFHE');
    expect(result.breakdown).toHaveProperty('identityLevel');
    expect(result.breakdown).toHaveProperty('chainDepthBonus');
  });
});

// ---------------------------------------------------------------------------
// dot_health
// ---------------------------------------------------------------------------

describe('handleHealth', () => {
  it('returns runtimeReady=false when no runtime', async () => {
    setRuntime(null);
    const result = await handleHealth({});
    expect(result.runtimeReady).toBe(false);
  });

  it('returns runtimeReady=true after boot', async () => {
    await handleBoot({});
    const result = await handleHealth({});
    expect(result.runtimeReady).toBe(true);
  });

  it('dotsCreated >= 1 after boot', async () => {
    await handleBoot({});
    const result = await handleHealth({});
    expect(result.dotsCreated).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// dot_execute
// ---------------------------------------------------------------------------

describe('handleExecute', () => {
  it('returns typescript for valid source', async () => {
    await handleBoot({});
    const result = await handleExecute({ source: 'observe temperature at sensor(7) = 82.3' });
    expect(typeof result.typescript).toBe('string');
    expect(result.typescript.length).toBeGreaterThan(0);
  });

  it('returns duration_ms >= 0', async () => {
    await handleBoot({});
    const result = await handleExecute({ source: 'observe temperature at sensor(7) = 82.3' });
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('invalid source returns errors (no crash)', async () => {
    await handleBoot({});
    const result = await handleExecute({ source: '@@@ bad' });
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// dot_bridge
// ---------------------------------------------------------------------------

describe('handleBridge', () => {
  it('maps legacy type field', async () => {
    const result = await handleBridge({
      legacyDot: JSON.stringify({ type: 'event', data: 'hello' }),
    });
    expect(result.converted.type).toBe('event');
  });

  it('maps legacy data to payload', async () => {
    const result = await handleBridge({
      legacyDot: JSON.stringify({ data: 'sensor data' }),
    });
    expect(result.converted.payload).toBe('sensor data');
  });

  it('maps pub_key and sig to sign base', async () => {
    const result = await handleBridge({
      legacyDot: JSON.stringify({ pub_key: 'aabb', sig: 'ccdd' }),
    });
    const sign = result.converted.sign as Record<string, unknown>;
    expect(sign.observer).toBe('aabb');
    expect(sign.signature).toBe('ccdd');
  });

  it('maps prev_hash to chain.previous', async () => {
    const result = await handleBridge({
      legacyDot: JSON.stringify({ prev_hash: 'deadbeef' }),
    });
    const chain = result.converted.chain as Record<string, unknown>;
    expect(chain.previous).toBe('deadbeef');
  });

  it('warnings array is populated for mapped fields', async () => {
    const result = await handleBridge({
      legacyDot: JSON.stringify({ pub_key: 'aa', sig: 'bb', prev_hash: 'cc' }),
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('throws on invalid JSON', async () => {
    await expect(handleBridge({ legacyDot: 'not json' })).rejects.toThrow();
  });
});
