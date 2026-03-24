/**
 * health.test.ts — runtimeHealth() tests.
 * Target: 10+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { runtimeHealth } from '../src/health.js';
import type { DotRuntime } from '../src/runtime.js';

let runtime: DotRuntime;

beforeEach(async () => {
  runtime = await createRuntime();
});

// ─────────────────────────────────────────────
// runtimeHealth() — shape
// ─────────────────────────────────────────────

describe('runtimeHealth() — shape', () => {
  it('returns a DOT', () => {
    const h = runtimeHealth(runtime);
    expect(h).toBeDefined();
    expect(typeof h).toBe('object');
  });

  it('DOT type is measure', () => {
    const h = runtimeHealth(runtime);
    expect(h.type).toBe('measure');
  });

  it('DOT has a payload', () => {
    const h = runtimeHealth(runtime);
    expect(h.payload).toBeInstanceOf(Uint8Array);
    expect(h.payload!.length).toBeGreaterThan(0);
  });

  it('payload is valid JSON', () => {
    const h = runtimeHealth(runtime);
    const text = new TextDecoder().decode(h.payload!);
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// runtimeHealth() — payload contents
// ─────────────────────────────────────────────

describe('runtimeHealth() — payload contents', () => {
  function decode(h: ReturnType<typeof runtimeHealth>) {
    return JSON.parse(new TextDecoder().decode(h.payload!));
  }

  it('uptime_ms is a non-negative number', () => {
    const h = runtimeHealth(runtime);
    const payload = decode(h);
    expect(typeof payload.uptime_ms).toBe('number');
    expect(payload.uptime_ms).toBeGreaterThanOrEqual(0);
  });

  it('dots_created is a positive integer', () => {
    const h = runtimeHealth(runtime);
    const payload = decode(h);
    expect(typeof payload.dots_created).toBe('number');
    expect(payload.dots_created).toBeGreaterThanOrEqual(1);
  });

  it('dots_created increases after observe()', async () => {
    const before = decode(runtimeHealth(runtime)).dots_created;
    await runtime.observe('test payload');
    const after = decode(runtimeHealth(runtime)).dots_created;
    expect(after).toBeGreaterThan(before);
  });

  it('chains_active is 1 (identity chain)', () => {
    const h = runtimeHealth(runtime);
    const payload = decode(h);
    expect(payload.chains_active).toBe(1);
  });

  it('identity_chain_depth equals appendCount', () => {
    const h = runtimeHealth(runtime);
    const payload = decode(h);
    expect(payload.identity_chain_depth).toBe(runtime.chain.appendCount);
  });

  it('memory_heap_used is a number', () => {
    const h = runtimeHealth(runtime);
    const payload = decode(h);
    expect(typeof payload.memory_heap_used).toBe('number');
  });
});
