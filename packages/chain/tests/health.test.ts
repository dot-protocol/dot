/**
 * Health tests — health(), checkAutoEmit(), getMetaChain().
 * Target: 15+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import { createChain, append } from '../src/dag.js';
import { health, checkAutoEmit, getMetaChain, clearMetaChains } from '../src/health.js';
import type { HealthReport } from '../src/health.js';

beforeEach(() => {
  clearMetaChains();
});

describe('health()', () => {
  it('returns a DOT of type measure', () => {
    const c = createChain();
    const h = health(c);
    expect(h.type).toBe('measure');
  });

  it('payload is a HealthReport JSON', () => {
    const c = createChain();
    const h = health(c);
    expect(h.payload).toBeDefined();
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report).toBeDefined();
  });

  it('reports correct chain_id', () => {
    const c = createChain(undefined, 'test-chain-id');
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.chain_id).toBe('test-chain-id');
  });

  it('reports total=0 for empty chain', () => {
    const c = createChain();
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.total).toBe(0);
  });

  it('reports correct total after appends', () => {
    let c = createChain();
    for (let i = 0; i < 5; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.total).toBe(5);
  });

  it('reports valid=true for intact chain', () => {
    let c = createChain();
    c = append(c, observe('x', { plaintext: true }));
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.valid).toBe(true);
  });

  it('reports verified_pct=100 for fully verified chain', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    c = append(c, observe('b', { plaintext: true }));
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.verified_pct).toBe(100);
  });

  it('reports storage_backend name', () => {
    const c = createChain();
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.storage_backend).toBe('memory');
  });

  it('reports append_count', () => {
    let c = createChain();
    c = append(c, observe('x', { plaintext: true }));
    c = append(c, observe('y', { plaintext: true }));
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.append_count).toBe(2);
  });

  it('reports observed_at as ISO timestamp string', () => {
    const c = createChain();
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(typeof report.observed_at).toBe('string');
    expect(() => new Date(report.observed_at)).not.toThrow();
  });

  it('reports errors array (empty for valid chain)', () => {
    const c = createChain();
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(Array.isArray(report.errors)).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('reports verified count equal to total for valid chain', () => {
    let c = createChain();
    for (let i = 0; i < 3; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const h = health(c);
    const report: HealthReport = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.verified).toBe(report.total);
  });

  it('health DOT has plaintext payload_mode', () => {
    const c = createChain();
    const h = health(c);
    expect(h.payload_mode).toBe('plain');
  });
});

// --- checkAutoEmit ---

describe('checkAutoEmit()', () => {
  it('returns null when appendCount is not a multiple of 100', () => {
    let c = createChain();
    c = append(c, observe('x', { plaintext: true }));
    // appendCount = 1, not a multiple of 100
    const result = checkAutoEmit(c);
    expect(result).toBeNull();
  });

  it('returns meta chain when appendCount is 100', () => {
    let c = createChain(undefined, 'auto-test');
    // Manually set appendCount to 100 (simulating 100 appends)
    c = { ...c, appendCount: 100 };
    const meta = checkAutoEmit(c);
    expect(meta).not.toBeNull();
  });

  it('meta chain gets a health DOT appended', () => {
    let c = createChain(undefined, 'auto-test-2');
    c = { ...c, appendCount: 100 };
    const meta = checkAutoEmit(c);
    expect(meta!.appendCount).toBe(1);
  });

  it('returns null for appendCount 0', () => {
    const c = createChain();
    const result = checkAutoEmit(c);
    expect(result).toBeNull();
  });

  it('returns meta chain for appendCount 200', () => {
    let c = createChain(undefined, 'auto-test-3');
    c = { ...c, appendCount: 200 };
    const meta = checkAutoEmit(c);
    expect(meta).not.toBeNull();
  });

  it('getMetaChain returns null before any auto-emit', () => {
    const result = getMetaChain('nonexistent-chain');
    expect(result).toBeNull();
  });

  it('getMetaChain returns the meta chain after auto-emit', () => {
    let c = createChain(undefined, 'retrievable-chain');
    c = { ...c, appendCount: 100 };
    checkAutoEmit(c);
    const meta = getMetaChain('retrievable-chain');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('retrievable-chain._meta');
  });

  it('meta chain id is chainId + "._meta"', () => {
    let c = createChain(undefined, 'my-chain');
    c = { ...c, appendCount: 100 };
    const meta = checkAutoEmit(c);
    expect(meta!.id).toBe('my-chain._meta');
  });

  it('accumulates multiple auto-emits in the same meta chain', () => {
    let c = createChain(undefined, 'accumulate-chain');
    c = { ...c, appendCount: 100 };
    checkAutoEmit(c);
    c = { ...c, appendCount: 200 };
    checkAutoEmit(c);
    const meta = getMetaChain('accumulate-chain');
    expect(meta!.appendCount).toBe(2);
  });
});
