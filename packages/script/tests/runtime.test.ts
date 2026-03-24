/**
 * runtime.test.ts — DotRuntime lifecycle tests.
 * Target: 25+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { createIdentity } from '@dot-protocol/core';
import { verify } from '@dot-protocol/core';

// ─────────────────────────────────────────────
// createRuntime — defaults
// ─────────────────────────────────────────────

describe('createRuntime — defaults', () => {
  it('creates a runtime with a valid identity', async () => {
    const rt = await createRuntime();
    expect(rt.identity).toBeDefined();
    expect(rt.identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(rt.identity.publicKey.length).toBe(32);
    expect(rt.identity.secretKey).toBeInstanceOf(Uint8Array);
    expect(rt.identity.secretKey.length).toBe(32);
  });

  it('creates distinct identities each time by default', async () => {
    const rt1 = await createRuntime();
    const rt2 = await createRuntime();
    const key1 = rt1.identity.publicKey;
    const key2 = rt2.identity.publicKey;
    // Should be different keys
    const same = key1.every((b, i) => b === key2[i]);
    expect(same).toBe(false);
  });

  it('has a chain with at least one DOT (genesis)', async () => {
    const rt = await createRuntime();
    expect(rt.chain.appendCount).toBeGreaterThanOrEqual(1);
  });

  it('has null mesh by default', async () => {
    const rt = await createRuntime();
    expect(rt.mesh).toBeUndefined();
  });

  it('returns a shutdown function', async () => {
    const rt = await createRuntime();
    await expect(rt.shutdown()).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// createRuntime — with identity
// ─────────────────────────────────────────────

describe('createRuntime — with provided identity', () => {
  it('uses the provided identity', async () => {
    const identity = await createIdentity();
    const rt = await createRuntime({ identity });
    expect(rt.identity.publicKey).toEqual(identity.publicKey);
    expect(rt.identity.secretKey).toEqual(identity.secretKey);
  });

  it('same identity produces same public key', async () => {
    const identity = await createIdentity();
    const rt1 = await createRuntime({ identity });
    const rt2 = await createRuntime({ identity });
    expect(rt1.identity.publicKey).toEqual(rt2.identity.publicKey);
  });
});

// ─────────────────────────────────────────────
// runtime.observe()
// ─────────────────────────────────────────────

describe('runtime.observe()', () => {
  it('creates a signed DOT', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe('hello');
    expect(dot.sign?.signature).toBeInstanceOf(Uint8Array);
    expect(dot.sign?.observer).toBeInstanceOf(Uint8Array);
  });

  it('creates a chained DOT (chain base present)', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe('test');
    expect(dot.chain?.previous).toBeInstanceOf(Uint8Array);
    expect(dot.chain?.depth).toBeGreaterThanOrEqual(1);
  });

  it('DOT has correct type when specified', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe('data', { type: 'measure' });
    expect(dot.type).toBe('measure');
  });

  it('DOT has event type', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe('event data', { type: 'event' });
    expect(dot.type).toBe('event');
  });

  it('DOT has state type', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe({ key: 'val' }, { type: 'state' });
    expect(dot.type).toBe('state');
  });

  it('successive observes increase chain depth', async () => {
    const rt = await createRuntime();
    const dot1 = await rt.observe('first');
    const dot2 = await rt.observe('second');
    expect((dot2.chain?.depth ?? 0)).toBeGreaterThan((dot1.chain?.depth ?? 0));
  });

  it('successive observes grow the chain appendCount', async () => {
    const rt = await createRuntime();
    const before = rt.chain.appendCount;
    await rt.observe('one');
    await rt.observe('two');
    expect(rt.chain.appendCount).toBe(before + 2);
  });

  it('observe creates a DOT whose signature verifies', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe('verifiable payload');
    const result = await verify(dot);
    expect(result.valid).toBe(true);
  });

  it('observe with no payload creates a valid DOT', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe();
    expect(dot).toBeDefined();
    expect(dot.sign?.signature).toBeDefined();
  });

  it('observe with object payload serializes it', async () => {
    const rt = await createRuntime();
    const dot = await rt.observe({ foo: 'bar', n: 42 });
    expect(dot.payload).toBeDefined();
  });

  it('throws after shutdown', async () => {
    const rt = await createRuntime();
    await rt.shutdown();
    await expect(rt.observe('after shutdown')).rejects.toThrow('shut down');
  });
});

// ─────────────────────────────────────────────
// runtime.health()
// ─────────────────────────────────────────────

describe('runtime.health()', () => {
  it('returns a DOT', async () => {
    const rt = await createRuntime();
    const h = rt.health();
    expect(h).toBeDefined();
  });

  it('health DOT has measure type', async () => {
    const rt = await createRuntime();
    const h = rt.health();
    expect(h.type).toBe('measure');
  });

  it('health DOT has payload', async () => {
    const rt = await createRuntime();
    const h = rt.health();
    expect(h.payload).toBeDefined();
    expect(h.payload!.length).toBeGreaterThan(0);
  });

  it('health payload contains uptime_ms', async () => {
    const rt = await createRuntime();
    // Small wait to ensure uptime > 0
    await new Promise((r) => setTimeout(r, 5));
    const h = rt.health();
    const decoded = JSON.parse(new TextDecoder().decode(h.payload!));
    expect(decoded.uptime_ms).toBeGreaterThanOrEqual(0);
  });

  it('health payload contains dots_created', async () => {
    const rt = await createRuntime();
    await rt.observe('a');
    const h = rt.health();
    const decoded = JSON.parse(new TextDecoder().decode(h.payload!));
    expect(decoded.dots_created).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
// runtime.shutdown()
// ─────────────────────────────────────────────

describe('runtime.shutdown()', () => {
  it('shutdown resolves without error', async () => {
    const rt = await createRuntime();
    await expect(rt.shutdown()).resolves.toBeUndefined();
  });

  it('calling shutdown twice does not throw', async () => {
    const rt = await createRuntime();
    await rt.shutdown();
    await expect(rt.shutdown()).resolves.toBeUndefined();
  });
});
