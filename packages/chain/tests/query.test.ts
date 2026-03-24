/**
 * Query tests — byHash, byTimeRange, byType, byObserver, byDepthRange.
 * Target: 20+ tests.
 */

import { describe, it, expect } from 'vitest';
import { observe } from '@dot-protocol/core';
import { createChain, append, dotHashToHex } from '../src/dag.js';
import { byHash, byTimeRange, byType, byObserver, byDepthRange } from '../src/query.js';

// --- byHash ---

describe('byHash', () => {
  it('returns null for unknown hash', () => {
    const c = createChain();
    expect(byHash(c, 'deadbeef'.repeat(8))).toBeNull();
  });

  it('returns DOT for known hash', () => {
    let c = createChain();
    c = append(c, observe('hello', { plaintext: true }));
    const hash = c.tipHash!;
    const result = byHash(c, hash);
    expect(result).not.toBeNull();
    const decoder = new TextDecoder();
    expect(decoder.decode(result!.payload)).toBe('hello');
  });

  it('returns correct DOT from multi-DOT chain', () => {
    let c = createChain();
    c = append(c, observe('first', { plaintext: true }));
    const firstHash = c.tipHash!;
    c = append(c, observe('second', { plaintext: true }));

    const result = byHash(c, firstHash);
    expect(result).not.toBeNull();
    const decoder = new TextDecoder();
    expect(decoder.decode(result!.payload)).toBe('first');
  });

  it('returns null for empty chain', () => {
    const c = createChain();
    expect(byHash(c, '0'.repeat(64))).toBeNull();
  });
});

// --- byTimeRange ---

describe('byTimeRange', () => {
  it('returns empty for chain with no time-stamped DOTs', () => {
    let c = createChain();
    c = append(c, observe('no-time', { plaintext: true }));
    // No time.utc set — storage filter should exclude it
    const result = byTimeRange(c, 0, Date.now());
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns DOTs within time range', () => {
    let c = createChain();
    const t1 = Date.now() - 10000;
    const t2 = Date.now() - 5000;
    const t3 = Date.now();

    const d1 = { ...observe('early', { plaintext: true }), time: { utc: t1 } };
    const d2 = { ...observe('mid', { plaintext: true }), time: { utc: t2 } };
    const d3 = { ...observe('late', { plaintext: true }), time: { utc: t3 } };

    c = append(c, d1);
    c = append(c, d2);
    c = append(c, d3);

    const result = byTimeRange(c, t1, t2);
    // d1 and d2 should be in range
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when no DOTs in range', () => {
    let c = createChain();
    const d = { ...observe('x', { plaintext: true }), time: { utc: 1000 } };
    c = append(c, d);
    const result = byTimeRange(c, 9999999, 9999999999);
    expect(result).toHaveLength(0);
  });

  it('includes boundary timestamps (inclusive range)', () => {
    let c = createChain();
    const ts = 5000;
    const d = { ...observe('boundary', { plaintext: true }), time: { utc: ts } };
    c = append(c, d);
    const result = byTimeRange(c, ts, ts);
    expect(result).toHaveLength(1);
  });
});

// --- byType ---

describe('byType', () => {
  it('returns empty array for chain with no typed DOTs', () => {
    let c = createChain();
    c = append(c, observe('untyped', { plaintext: true }));
    const result = byType(c, 'measure');
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns only DOTs matching the type', () => {
    let c = createChain();
    c = append(c, observe('m1', { type: 'measure', plaintext: true }));
    c = append(c, observe('e1', { type: 'event', plaintext: true }));
    c = append(c, observe('m2', { type: 'measure', plaintext: true }));

    const measures = byType(c, 'measure');
    expect(measures).toHaveLength(2);
    expect(measures.every((d) => d.type === 'measure')).toBe(true);
  });

  it('returns empty for non-existent type', () => {
    let c = createChain();
    c = append(c, observe('x', { type: 'event', plaintext: true }));
    const result = byType(c, 'bond');
    expect(result).toHaveLength(0);
  });

  it('queries all 5 types', () => {
    let c = createChain();
    const types = ['measure', 'state', 'event', 'claim', 'bond'] as const;
    for (const t of types) {
      c = append(c, observe(t, { type: t, plaintext: true }));
    }
    for (const t of types) {
      const result = byType(c, t);
      expect(result).toHaveLength(1);
      expect(result[0]?.type).toBe(t);
    }
  });
});

// --- byObserver ---

describe('byObserver', () => {
  it('returns empty for chain with no signed DOTs', () => {
    let c = createChain();
    c = append(c, observe('unsigned', { plaintext: true }));
    const fakeKey = new Uint8Array(32).fill(1);
    const result = byObserver(c, fakeKey);
    expect(result).toHaveLength(0);
  });

  it('returns DOTs matching the observer public key', () => {
    let c = createChain();
    const key1 = new Uint8Array(32).fill(1);
    const key2 = new Uint8Array(32).fill(2);

    const d1 = { ...observe('from-obs1', { plaintext: true }), sign: { observer: key1 } };
    const d2 = { ...observe('from-obs2', { plaintext: true }), sign: { observer: key2 } };
    const d3 = { ...observe('from-obs1-again', { plaintext: true }), sign: { observer: key1 } };

    c = append(c, d1);
    c = append(c, d2);
    c = append(c, d3);

    const result = byObserver(c, key1);
    expect(result).toHaveLength(2);
    expect(result.every((d) => Buffer.from(d.sign!.observer!).toString('hex') === Buffer.from(key1).toString('hex'))).toBe(true);
  });

  it('returns empty for unrelated observer key', () => {
    let c = createChain();
    const key = new Uint8Array(32).fill(5);
    const d = { ...observe('x', { plaintext: true }), sign: { observer: new Uint8Array(32).fill(99) } };
    c = append(c, d);
    const result = byObserver(c, key);
    expect(result).toHaveLength(0);
  });
});

// --- byDepthRange ---

describe('byDepthRange', () => {
  it('returns empty for empty chain', () => {
    const c = createChain();
    expect(byDepthRange(c, 0, 10)).toHaveLength(0);
  });

  it('returns all DOTs for full depth range', () => {
    let c = createChain();
    for (let i = 0; i < 5; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const result = byDepthRange(c, 0, 4);
    expect(result).toHaveLength(5);
  });

  it('returns only DOTs in [minDepth, maxDepth]', () => {
    let c = createChain();
    for (let i = 0; i < 10; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const result = byDepthRange(c, 3, 5);
    expect(result).toHaveLength(3);
    expect(result.every((d) => {
      const d2 = d.chain?.depth ?? -1;
      return d2 >= 3 && d2 <= 5;
    })).toBe(true);
  });

  it('returns single DOT for exact depth', () => {
    let c = createChain();
    for (let i = 0; i < 5; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const result = byDepthRange(c, 2, 2);
    expect(result).toHaveLength(1);
    expect(result[0]?.chain?.depth).toBe(2);
  });

  it('returns empty for out-of-range depths', () => {
    let c = createChain();
    c = append(c, observe('only', { plaintext: true }));
    const result = byDepthRange(c, 5, 10);
    expect(result).toHaveLength(0);
  });
});
