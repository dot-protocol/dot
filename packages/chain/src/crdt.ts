/**
 * crdt.ts — CRDT merge semantics for forked DOT chains.
 *
 * When two chains diverge from a common ancestor, detectFork identifies the
 * fork point and merge creates a new merged chain containing DOTs from both
 * branches plus a merge-event DOT.
 */

import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createChain, append, walk, depth, dotHashToHex, type Chain } from './dag.js';
import { MemoryStorage } from './storage/memory.js';

/** Result of detectFork. */
export interface ForkResult {
  /** True if the chains have diverged (non-prefix relationship). */
  forked: boolean;
  /** Hex hash of the last common ancestor DOT, or undefined if none. */
  commonAncestor?: string;
}

/**
 * Detect whether two chains have forked.
 *
 * Two chains are considered forked when they have diverged past a common
 * ancestor — i.e. neither is a prefix of the other and their tip hashes differ.
 *
 * A chain is a prefix of another when its tip appears in the other chain's
 * history.
 *
 * @returns ForkResult with forked flag and optionally the common ancestor hash
 */
export function detectFork(a: Chain, b: Chain): ForkResult {
  // Both empty → no fork
  if (a.tipHash === null && b.tipHash === null) {
    return { forked: false };
  }

  // One empty → no fork (empty has no tip to conflict)
  if (a.tipHash === null || b.tipHash === null) {
    return { forked: false };
  }

  // Same tip → identical (no fork)
  if (a.tipHash === b.tipHash) {
    return { forked: false };
  }

  // Build hash → DOT maps for both chains
  const mapA = buildHashMap(a);
  const mapB = buildHashMap(b);

  // If a's tip is in b's ancestry → a is a prefix of b (no fork)
  if (mapB.has(a.tipHash)) {
    return { forked: false };
  }

  // If b's tip is in a's ancestry → b is a prefix of a (no fork)
  if (mapA.has(b.tipHash)) {
    return { forked: false };
  }

  // Find deepest common ancestor: hashes present in both maps
  let bestAncestor: string | undefined;
  let bestDepth = -1;

  for (const [h, dot] of mapA) {
    if (mapB.has(h)) {
      const d = dot.chain?.depth ?? 0;
      if (d > bestDepth) {
        bestDepth = d;
        bestAncestor = h;
      }
    }
  }

  // No common hashes → completely disjoint
  if (bestAncestor === undefined) {
    return { forked: true };
  }

  return { forked: true, commonAncestor: bestAncestor };
}

/**
 * Merge two chains into a single new chain.
 *
 * - If not forked (one is prefix of the other), returns a copy of the longer chain.
 * - If forked, copies all DOTs from both branches into a new chain in order,
 *   then appends a merge-event DOT referencing both branch tips.
 *
 * The returned chain is independent of the inputs (new MemoryStorage).
 * Input chains are never mutated.
 */
export function merge(a: Chain, b: Chain): Chain {
  // Both empty → return empty chain
  if (a.tipHash === null && b.tipHash === null) {
    return createChain();
  }

  const fork = detectFork(a, b);

  if (!fork.forked) {
    // Return a copy of whichever is longer (or a if equal)
    if (depth(b) > depth(a)) {
      return copyChain(b);
    }
    return copyChain(a);
  }

  // True fork: create new merged chain with all DOTs from both branches
  let result = createChain(new MemoryStorage(), a.id + ':merged:' + b.id);

  // Append all DOTs from branch A (root-first)
  const dotsA = walk(a);
  for (const dot of dotsA) {
    result = append(result, stripChain(dot));
  }

  // Append all DOTs from branch B (root-first)
  const dotsB = walk(b);
  for (const dot of dotsB) {
    result = append(result, stripChain(dot));
  }

  // Create merge event DOT recording both branch tips and common ancestor
  const mergePayload = JSON.stringify({
    type: 'merge',
    branch_a_tip: a.tipHash,
    branch_b_tip: b.tipHash,
    common_ancestor: fork.commonAncestor ?? null,
  });

  const mergeDot = observe(mergePayload, { type: 'event', plaintext: true });
  result = append(result, mergeDot);

  return result;
}

// --- helpers ---

/** Build a map of hash → DOT for all DOTs in a chain. */
function buildHashMap(c: Chain): Map<string, DOT> {
  const all = walk(c);
  const map = new Map<string, DOT>();
  for (const dot of all) {
    map.set(dotHashToHex(dot), dot);
  }
  return map;
}

/** Copy a chain's DOTs into a new independent MemoryStorage-backed chain. */
function copyChain(source: Chain): Chain {
  const all = walk(source);
  let result = createChain(new MemoryStorage(), source.id);
  for (const dot of all) {
    result = append(result, stripChain(dot));
  }
  return result;
}

/**
 * Strip chain linkage from a DOT so it can be re-appended to a new chain.
 * Removes chain.previous and chain.depth — append() will re-link it.
 */
function stripChain(dot: DOT): DOT {
  const { chain: _chain, ...rest } = dot;
  return rest;
}
