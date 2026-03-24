/**
 * dag.ts — Merkle DAG for DOT chains.
 *
 * A Chain is an append-only DAG where each DOT references the hash of the
 * previous one. Immutable API: every operation returns a new Chain value.
 *
 * Hash representation: hex strings (64 chars) for stable storage keys.
 */

import { hash as coreHash, chain as coreChain } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { MemoryStorage } from './storage/memory.js';
import type { StorageBackend } from './storage/interface.js';

/** Unique identifier + storage + pointer to the current tip. */
export interface Chain {
  /** Unique identifier for this chain instance. */
  readonly id: string;
  /** Pluggable storage backend. */
  readonly storage: StorageBackend;
  /** Hex-encoded hash of the tip DOT, or null if the chain is empty. */
  readonly tipHash: string | null;
  /** Total number of DOTs ever appended (monotonically increasing). */
  readonly appendCount: number;
}

/** Result of verify_chain. */
export interface VerifyResult {
  valid: boolean;
  errors: string[];
  verified: number;
}

/** Compute the BLAKE3 hash of a DOT and return it as a hex string. */
export function dotHashToHex(dot: DOT): string {
  const bytes = coreHash(dot);
  return bufToHex(bytes);
}

/** Convert a Uint8Array to a lowercase hex string. */
export function bufToHex(buf: Uint8Array): string {
  return Buffer.from(buf).toString('hex');
}

/** Convert a hex string to a Uint8Array. */
export function hexToBuf(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/** Simple random ID generator (no external deps). */
function randomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/**
 * Create a new empty chain.
 *
 * @param storage - Storage backend (defaults to MemoryStorage)
 * @param id - Custom chain ID (defaults to a random string)
 */
export function createChain(storage?: StorageBackend, id?: string): Chain {
  return {
    id: id ?? randomId(),
    storage: storage ?? new MemoryStorage(),
    tipHash: null,
    appendCount: 0,
  };
}

/**
 * Append a DOT to the chain.
 *
 * Links the DOT into the causal chain (sets chain.previous and chain.depth),
 * stores it, and returns an updated Chain with the new tipHash.
 *
 * Does NOT mutate the input chain — returns a new Chain value.
 *
 * @throws If tipHash is non-null but the tip DOT cannot be found in storage.
 */
export function append(c: Chain, dot: DOT): Chain {
  let previous: DOT | undefined = undefined;

  if (c.tipHash !== null) {
    const prev = c.storage.get(c.tipHash);
    if (prev === null) {
      throw new Error(
        `Chain integrity error: tipHash "${c.tipHash}" not found in storage`
      );
    }
    previous = prev;
  }

  // Link the DOT into the causal chain (sets chain.previous and chain.depth)
  const linked = coreChain(dot, previous);

  // Compute hash and store
  const hash = dotHashToHex(linked);
  const chainDepth = linked.chain?.depth ?? 0;
  const timestamp = linked.time?.utc ?? 0;
  c.storage.put(linked, hash, { depth: chainDepth, timestamp });

  return {
    ...c,
    tipHash: hash,
    appendCount: c.appendCount + 1,
  };
}

/**
 * Walk the chain from a given hash back to the root, returning DOTs
 * in root-first (oldest-first) order.
 *
 * @param c - The chain to walk
 * @param from - Starting hash (defaults to chain.tipHash)
 */
export function walk(c: Chain, from?: string | null): DOT[] {
  const startHash = from !== undefined ? from : c.tipHash;
  if (startHash === null || startHash === undefined) return [];

  // Collect from tip back to root
  const collected: DOT[] = [];
  let currentHash: string | null = startHash;

  while (currentHash !== null) {
    const dot = c.storage.get(currentHash);
    if (dot === null) break;
    collected.push(dot);

    const prev = dot.chain?.previous;
    if (prev === undefined) break;

    // Genesis sentinel: 32 zero bytes
    const isGenesis = prev.every((b) => b === 0);
    if (isGenesis) break;

    currentHash = bufToHex(prev);
  }

  // Reverse to get root-first order
  return collected.reverse();
}

/**
 * Return the tip (most recently appended) DOT, or null for an empty chain.
 */
export function tip(c: Chain): DOT | null {
  if (c.tipHash === null) return null;
  return c.storage.get(c.tipHash);
}

/**
 * Return the root (genesis, depth=0) DOT, or null for an empty chain.
 */
export function root(c: Chain): DOT | null {
  if (c.tipHash === null) return null;
  const all = walk(c);
  return all[0] ?? null;
}

/**
 * Return the number of DOTs in the chain (equals appendCount).
 *
 * For an empty chain returns 0.
 */
export function depth(c: Chain): number {
  return c.appendCount;
}

/**
 * Verify the causal integrity of a chain.
 *
 * Walks from tip to root, checking:
 * - Each DOT exists in storage
 * - chain.previous matches the hash of the prior DOT
 *
 * @returns VerifyResult with valid flag, error list, and verified count
 */
export function verify_chain(c: Chain): VerifyResult {
  if (c.tipHash === null) {
    return { valid: true, errors: [], verified: 0 };
  }

  const errors: string[] = [];
  let verified = 0;
  let currentHash: string | null = c.tipHash;

  while (currentHash !== null) {
    const dot = c.storage.get(currentHash);
    if (dot === null) {
      errors.push(`Missing DOT for hash: ${currentHash}`);
      break;
    }
    verified++;

    const prev = dot.chain?.previous;
    if (prev === undefined) break;

    const isGenesis = prev.every((b) => b === 0);
    if (isGenesis) break;

    const prevHash = bufToHex(prev);

    // Verify the hash of the previous DOT matches what's recorded
    const prevDot = c.storage.get(prevHash);
    if (prevDot === null) {
      errors.push(`Missing previous DOT for hash: ${prevHash}`);
      break;
    }

    const computedHash = dotHashToHex(prevDot);
    if (computedHash !== prevHash) {
      errors.push(
        `Hash mismatch at depth ${dot.chain?.depth ?? '?'}: recorded=${prevHash}, computed=${computedHash}`
      );
    }

    currentHash = prevHash;
  }

  return {
    valid: errors.length === 0,
    errors,
    verified,
  };
}
