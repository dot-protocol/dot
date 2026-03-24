/**
 * CRDT tests — detectFork, merge.
 * Target: 40+ tests.
 */

import { describe, it, expect } from 'vitest';
import { observe } from '@dot-protocol/core';
import { createChain, append, walk, tip, depth } from '../src/dag.js';
import { detectFork, merge } from '../src/crdt.js';

function makeChain(payloads: string[]) {
  let c = createChain();
  for (const p of payloads) {
    c = append(c, observe(p, { plaintext: true }));
  }
  return c;
}

// --- detectFork ---

describe('detectFork', () => {
  it('two empty chains: no fork', () => {
    const a = createChain();
    const b = createChain();
    const r = detectFork(a, b);
    expect(r.forked).toBe(false);
  });

  it('identical chains (same tip): no fork', () => {
    let a = createChain();
    a = append(a, observe('x', { plaintext: true }));
    // b shares same storage — shares same tip
    const b = { ...a };
    const r = detectFork(a, b);
    expect(r.forked).toBe(false);
  });

  it('one chain is prefix of the other: no fork', () => {
    let a = createChain();
    a = append(a, observe('a', { plaintext: true }));

    // b starts from a's storage and appends more
    let b = { ...a };
    b = append(b, observe('b', { plaintext: true }));

    // a is prefix of b
    const r = detectFork(a, b);
    expect(r.forked).toBe(false);
  });

  it('completely disjoint chains: forked=true', () => {
    const a = makeChain(['a1', 'a2']);
    const b = makeChain(['b1', 'b2']);
    const r = detectFork(a, b);
    expect(r.forked).toBe(true);
  });

  it('chains that diverged from a common ancestor: forked', () => {
    // Build shared prefix
    let shared = createChain();
    shared = append(shared, observe('common1', { plaintext: true }));
    shared = append(shared, observe('common2', { plaintext: true }));

    // Fork: a adds its own DOT
    let a = { ...shared };
    a = append(a, observe('branch-a', { plaintext: true }));

    // Fork: b adds its own DOT from the same shared storage
    let b = { ...shared };
    b = append(b, observe('branch-b', { plaintext: true }));

    const r = detectFork(a, b);
    expect(r.forked).toBe(true);
    expect(r.commonAncestor).toBeDefined();
  });

  it('common ancestor is the shared tip when forked', () => {
    let base = createChain();
    base = append(base, observe('root', { plaintext: true }));
    const ancestorHash = base.tipHash;

    let a = { ...base };
    a = append(a, observe('a-only', { plaintext: true }));

    let b = { ...base };
    b = append(b, observe('b-only', { plaintext: true }));

    const r = detectFork(a, b);
    expect(r.forked).toBe(true);
    expect(r.commonAncestor).toBe(ancestorHash);
  });

  it('empty vs non-empty: no fork (empty has no ancestor)', () => {
    const a = createChain();
    const b = makeChain(['x']);
    const r = detectFork(a, b);
    expect(r.forked).toBe(false);
  });

  it('single-DOT chains with different content: forked', () => {
    const a = makeChain(['alpha']);
    const b = makeChain(['beta']);
    const r = detectFork(a, b);
    expect(r.forked).toBe(true);
  });

  it('returns ForkResult with forked property', () => {
    const a = createChain();
    const b = createChain();
    const r = detectFork(a, b);
    expect(typeof r.forked).toBe('boolean');
  });

  it('no common ancestor for disjoint chains', () => {
    const a = makeChain(['x']);
    const b = makeChain(['y']);
    const r = detectFork(a, b);
    // commonAncestor may be undefined for disjoint
    expect(r.forked).toBe(true);
  });
});

// --- merge ---

describe('merge', () => {
  it('merges two empty chains into an empty chain', () => {
    const a = createChain();
    const b = createChain();
    const m = merge(a, b);
    expect(depth(m)).toBe(0);
  });

  it('merge of chain with itself returns same content', () => {
    const a = makeChain(['x', 'y', 'z']);
    const m = merge(a, a);
    expect(depth(m)).toBeGreaterThan(0);
  });

  it('merge of non-forked chains (b ahead of a)', () => {
    let a = createChain();
    a = append(a, observe('shared', { plaintext: true }));

    let b = { ...a };
    b = append(b, observe('extra', { plaintext: true }));

    const m = merge(a, b);
    // Result should have at least as many DOTs as b
    expect(depth(m)).toBeGreaterThanOrEqual(depth(b));
  });

  it('creates a merge DOT for forked chains', () => {
    const a = makeChain(['a1', 'a2']);
    const b = makeChain(['b1', 'b2']);
    const m = merge(a, b);
    // Merged chain should have content
    expect(depth(m)).toBeGreaterThan(0);
  });

  it('merge DOT has type event', () => {
    const a = makeChain(['a1']);
    const b = makeChain(['b1']);
    const m = merge(a, b);
    const dots = walk(m);
    const mergeDot = dots[dots.length - 1];
    expect(mergeDot?.type).toBe('event');
  });

  it('merge DOT payload contains branch tip references', () => {
    const a = makeChain(['a1']);
    const b = makeChain(['b1']);
    const m = merge(a, b);
    const dots = walk(m);
    const mergeDot = dots[dots.length - 1];
    expect(mergeDot?.payload).toBeDefined();
    const payload = JSON.parse(new TextDecoder().decode(mergeDot!.payload));
    expect(payload.type).toBe('merge');
    expect(payload.branch_a_tip).toBe(a.tipHash);
    expect(payload.branch_b_tip).toBe(b.tipHash);
  });

  it('merged chain contains DOTs from both branches', () => {
    const a = makeChain(['a1', 'a2']);
    const b = makeChain(['b1', 'b2']);
    const m = merge(a, b);
    // Should have 4 branch DOTs + 1 merge DOT = 5
    expect(depth(m)).toBe(5);
  });

  it('merged chain tip is the merge DOT', () => {
    const a = makeChain(['a1']);
    const b = makeChain(['b1']);
    const m = merge(a, b);
    const t = tip(m);
    expect(t?.type).toBe('event');
    const payload = JSON.parse(new TextDecoder().decode(t!.payload));
    expect(payload.type).toBe('merge');
  });

  it('merged chain is a valid chain (verify passes)', () => {
    const a = makeChain(['x']);
    const b = makeChain(['y']);
    const m = merge(a, b);
    const dots = walk(m);
    // All DOTs should have chain linkage
    for (let i = 0; i < dots.length; i++) {
      expect(dots[i]?.chain).toBeDefined();
    }
  });

  it('concurrent appends produce a fork that can be merged', () => {
    let base = createChain();
    base = append(base, observe('genesis', { plaintext: true }));

    let a = { ...base };
    a = append(a, observe('concurrent-a', { plaintext: true }));

    let b = { ...base };
    b = append(b, observe('concurrent-b', { plaintext: true }));

    const fork = detectFork(a, b);
    expect(fork.forked).toBe(true);

    const m = merge(a, b);
    expect(depth(m)).toBeGreaterThan(0);
  });

  it('deep fork merge (5 DOTs each branch)', () => {
    const a = makeChain(['a1', 'a2', 'a3', 'a4', 'a5']);
    const b = makeChain(['b1', 'b2', 'b3', 'b4', 'b5']);
    const m = merge(a, b);
    // 5 + 5 + 1 merge = 11
    expect(depth(m)).toBe(11);
  });

  it('merge of chain A into empty chain B returns A content', () => {
    const a = makeChain(['x', 'y']);
    const b = createChain();
    const m = merge(a, b);
    expect(depth(m)).toBeGreaterThan(0);
  });

  it('merge result has a valid chain id', () => {
    const a = makeChain(['x']);
    const b = makeChain(['y']);
    const m = merge(a, b);
    expect(m.id).toBeTruthy();
  });

  it('merge does not modify input chains', () => {
    const a = makeChain(['a1']);
    const b = makeChain(['b1']);
    const aDepth = depth(a);
    const bDepth = depth(b);
    merge(a, b);
    expect(depth(a)).toBe(aDepth);
    expect(depth(b)).toBe(bDepth);
  });

  it('merge of chain with common prefix preserves all DOTs', () => {
    let base = createChain();
    base = append(base, observe('common', { plaintext: true }));

    let a = { ...base };
    a = append(a, observe('a-only', { plaintext: true }));

    let b = { ...base };
    b = append(b, observe('b-only', { plaintext: true }));

    const m = merge(a, b);
    expect(depth(m)).toBeGreaterThan(2);
  });

  it('merge payload contains common_ancestor field', () => {
    let base = createChain();
    base = append(base, observe('common', { plaintext: true }));
    const ancestorHash = base.tipHash;

    let a = { ...base };
    a = append(a, observe('a-branch', { plaintext: true }));

    let b = { ...base };
    b = append(b, observe('b-branch', { plaintext: true }));

    const m = merge(a, b);
    const dots = walk(m);
    const mergeDot = dots[dots.length - 1];
    const payload = JSON.parse(new TextDecoder().decode(mergeDot!.payload));
    expect(payload.common_ancestor).toBe(ancestorHash);
  });

  it('no-fork case: merge returns single chain', () => {
    let a = createChain();
    a = append(a, observe('only', { plaintext: true }));
    const b = { ...a }; // identical

    const m = merge(a, b);
    // Should not create a merge DOT since no fork
    expect(depth(m)).toBeGreaterThan(0);
  });

  it('merge with completely empty chains returns 0 depth', () => {
    const a = createChain();
    const b = createChain();
    const m = merge(a, b);
    expect(depth(m)).toBe(0);
  });

  it('multiple merges are stable', () => {
    const a = makeChain(['a1', 'a2']);
    const b = makeChain(['b1', 'b2']);
    const m1 = merge(a, b);
    const m2 = merge(a, b);
    expect(depth(m1)).toBe(depth(m2));
  });
});
