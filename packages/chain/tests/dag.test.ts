/**
 * DAG tests — createChain, append, walk, tip, root, depth, verify_chain.
 * Target: 50+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import {
  createChain,
  append,
  walk,
  tip,
  root,
  depth,
  verify_chain,
  dotHashToHex,
  bufToHex,
} from '../src/dag.js';
import type { Chain } from '../src/dag.js';
import { MemoryStorage } from '../src/storage/memory.js';

// --- createChain ---

describe('createChain', () => {
  it('creates an empty chain with no tip', () => {
    const c = createChain();
    expect(c.tipHash).toBeNull();
  });

  it('has a non-empty id', () => {
    const c = createChain();
    expect(c.id.length).toBeGreaterThan(0);
  });

  it('accepts a custom id', () => {
    const c = createChain(undefined, 'my-chain');
    expect(c.id).toBe('my-chain');
  });

  it('accepts a custom storage backend', () => {
    const storage = new MemoryStorage();
    const c = createChain(storage);
    expect(c.storage).toBe(storage);
  });

  it('starts with appendCount 0', () => {
    const c = createChain();
    expect(c.appendCount).toBe(0);
  });

  it('creates unique ids for different chains', () => {
    const c1 = createChain();
    const c2 = createChain();
    expect(c1.id).not.toBe(c2.id);
  });
});

// --- append ---

describe('append', () => {
  it('appends a genesis DOT (first DOT)', () => {
    let c = createChain();
    const dot = observe('hello', { plaintext: true });
    c = append(c, dot);
    expect(c.tipHash).not.toBeNull();
  });

  it('increments appendCount on each append', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    c = append(c, observe('b', { plaintext: true }));
    c = append(c, observe('c', { plaintext: true }));
    expect(c.appendCount).toBe(3);
  });

  it('genesis DOT has depth 0', () => {
    let c = createChain();
    c = append(c, observe('genesis', { plaintext: true }));
    const t = tip(c);
    expect(t?.chain?.depth).toBe(0);
  });

  it('second DOT has depth 1', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    c = append(c, observe('b', { plaintext: true }));
    const t = tip(c);
    expect(t?.chain?.depth).toBe(1);
  });

  it('depth increments correctly for 10 DOTs', () => {
    let c = createChain();
    for (let i = 0; i < 10; i++) {
      c = append(c, observe(`dot-${i}`, { plaintext: true }));
    }
    const t = tip(c);
    expect(t?.chain?.depth).toBe(9);
  });

  it('each DOT gets chain.previous set to previous tip hash', () => {
    let c = createChain();
    c = append(c, observe('first', { plaintext: true }));
    const firstHash = c.tipHash;
    c = append(c, observe('second', { plaintext: true }));
    const second = tip(c);
    expect(second?.chain?.previous).toBeDefined();
    expect(bufToHex(second!.chain!.previous!)).toBe(firstHash);
  });

  it('genesis DOT chain.previous is 32 zero bytes', () => {
    let c = createChain();
    c = append(c, observe('g', { plaintext: true }));
    const g = tip(c);
    const prev = g?.chain?.previous;
    expect(prev).toBeDefined();
    expect(prev).toEqual(new Uint8Array(32));
  });

  it('does not mutate original chain', () => {
    const c = createChain();
    const c2 = append(c, observe('x', { plaintext: true }));
    expect(c.tipHash).toBeNull();
    expect(c2.tipHash).not.toBeNull();
  });

  it('throws if tip hash is missing from storage', () => {
    const storage = new MemoryStorage();
    const c: Chain = { id: 'bad', storage, tipHash: 'deadbeef'.repeat(8), appendCount: 1 };
    expect(() => append(c, observe('x', { plaintext: true }))).toThrow();
  });

  it('stores DOTs with the payload set', () => {
    let c = createChain();
    c = append(c, observe('payload-test', { plaintext: true }));
    const t = tip(c);
    const decoder = new TextDecoder();
    expect(decoder.decode(t?.payload)).toBe('payload-test');
  });
});

// --- tip ---

describe('tip', () => {
  it('returns null for empty chain', () => {
    const c = createChain();
    expect(tip(c)).toBeNull();
  });

  it('returns the last appended DOT', () => {
    let c = createChain();
    c = append(c, observe('first', { plaintext: true }));
    c = append(c, observe('last', { plaintext: true }));
    const t = tip(c);
    const decoder = new TextDecoder();
    expect(decoder.decode(t?.payload)).toBe('last');
  });

  it('tip hash matches hash of the tip DOT', () => {
    let c = createChain();
    c = append(c, observe('x', { plaintext: true }));
    const t = tip(c);
    expect(dotHashToHex(t!)).toBe(c.tipHash);
  });
});

// --- root ---

describe('root', () => {
  it('returns null for empty chain', () => {
    const c = createChain();
    expect(root(c)).toBeNull();
  });

  it('returns genesis for single-DOT chain', () => {
    let c = createChain();
    c = append(c, observe('genesis', { plaintext: true }));
    const r = root(c);
    expect(r?.chain?.depth).toBe(0);
  });

  it('returns genesis (depth 0) after 5 appends', () => {
    let c = createChain();
    for (let i = 0; i < 5; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const r = root(c);
    expect(r?.chain?.depth).toBe(0);
  });

  it('genesis content is preserved', () => {
    let c = createChain();
    c = append(c, observe('root-content', { plaintext: true }));
    c = append(c, observe('later', { plaintext: true }));
    const r = root(c);
    const decoder = new TextDecoder();
    expect(decoder.decode(r?.payload)).toBe('root-content');
  });
});

// --- depth ---

describe('depth', () => {
  it('returns 0 for empty chain', () => {
    const c = createChain();
    expect(depth(c)).toBe(0);
  });

  it('returns 1 after one append', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    expect(depth(c)).toBe(1);
  });

  it('returns correct count for 10 DOTs', () => {
    let c = createChain();
    for (let i = 0; i < 10; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    expect(depth(c)).toBe(10);
  });
});

// --- walk ---

describe('walk', () => {
  it('returns empty array for empty chain', () => {
    const c = createChain();
    expect(walk(c)).toEqual([]);
  });

  it('returns single DOT for one-DOT chain', () => {
    let c = createChain();
    c = append(c, observe('only', { plaintext: true }));
    const result = walk(c);
    expect(result).toHaveLength(1);
  });

  it('returns DOTs in root-first order', () => {
    let c = createChain();
    c = append(c, observe('first', { plaintext: true }));
    c = append(c, observe('second', { plaintext: true }));
    c = append(c, observe('third', { plaintext: true }));
    const result = walk(c);
    expect(result).toHaveLength(3);
    const decoder = new TextDecoder();
    expect(decoder.decode(result[0]?.payload)).toBe('first');
    expect(decoder.decode(result[2]?.payload)).toBe('third');
  });

  it('walk count matches depth count', () => {
    let c = createChain();
    for (let i = 0; i < 7; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    expect(walk(c)).toHaveLength(7);
  });

  it('accepts custom from hash', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    c = append(c, observe('b', { plaintext: true }));
    const secondHash = c.tipHash;
    c = append(c, observe('c', { plaintext: true }));

    // Walk from second DOT
    const result = walk(c, secondHash);
    expect(result).toHaveLength(2);
  });

  it('returns empty for null from hash', () => {
    const c = createChain();
    expect(walk(c, null)).toEqual([]);
  });
});

// --- verify_chain ---

describe('verify_chain', () => {
  it('valid: true for empty chain', () => {
    const c = createChain();
    const result = verify_chain(c);
    expect(result.valid).toBe(true);
    expect(result.verified).toBe(0);
  });

  it('valid: true for a 3-DOT chain', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    c = append(c, observe('b', { plaintext: true }));
    c = append(c, observe('c', { plaintext: true }));
    const result = verify_chain(c);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.verified).toBe(3);
  });

  it('verified count matches chain length', () => {
    let c = createChain();
    for (let i = 0; i < 10; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    const result = verify_chain(c);
    expect(result.verified).toBe(10);
  });

  it('detects missing DOT in storage', () => {
    let c = createChain();
    c = append(c, observe('a', { plaintext: true }));
    // Corrupt: set tipHash to nonexistent hash
    const corruptChain = { ...c, tipHash: 'deadbeef'.repeat(8) };
    const result = verify_chain(corruptChain);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('has empty errors array for valid chain', () => {
    let c = createChain();
    c = append(c, observe('x', { plaintext: true }));
    const result = verify_chain(c);
    expect(result.errors).toEqual([]);
  });
});

// --- 1000-DOT performance test ---

describe('performance', () => {
  it('appends 1000 DOTs in under 500ms', () => {
    let c = createChain();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      c = append(c, observe(`dot-${i}`, { plaintext: true }));
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
    expect(depth(c)).toBe(1000);
  });

  it('walk of 100-DOT chain returns correct count', () => {
    let c = createChain();
    for (let i = 0; i < 100; i++) {
      c = append(c, observe(`d${i}`, { plaintext: true }));
    }
    expect(walk(c)).toHaveLength(100);
  });
});
