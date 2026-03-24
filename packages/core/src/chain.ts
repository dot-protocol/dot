/**
 * chain() and hash() — causal chaining for DOTs.
 *
 * DOTs can be linked into a causal chain where each DOT references
 * the hash of the previous one, forming a tamper-evident sequence.
 * A DOT without a previous is a genesis DOT (chain.previous = 32 zero bytes, depth = 0).
 */

import { createHashSync } from './hash.js';
import { toBytes } from './encode.js';
import type { DOT } from './types.js';

/** 32 zero bytes — the genesis sentinel value for chain.previous. */
const GENESIS_HASH = new Uint8Array(32);

/**
 * Computes the BLAKE3 hash of a DOT's canonical encoded bytes.
 *
 * The hash is computed over toBytes(dot), which captures all present fields
 * in deterministic TLV order. This hash can be used as chain.previous
 * in a subsequent DOT to establish causal linkage.
 *
 * @param dot - The DOT to hash
 * @returns 32-byte BLAKE3 hash as Uint8Array
 *
 * @example
 * const dot = observe('event A');
 * const h = hash(dot);
 * // h is a 32-byte Uint8Array
 */
export function hash(dot: DOT): Uint8Array {
  const encoded = toBytes(dot);
  return createHashSync(encoded);
}

/**
 * Links a DOT into a causal chain by setting chain.previous and chain.depth.
 *
 * If no previous DOT is provided, produces a genesis DOT:
 * - chain.previous = 32 zero bytes
 * - chain.depth = 0
 *
 * If a previous DOT is provided:
 * - chain.previous = hash(previous)
 * - chain.depth = (previous.chain?.depth ?? 0) + 1
 *
 * Returns a new DOT — the input is not mutated.
 *
 * @param dot - The DOT to add chain information to
 * @param previous - The previous DOT in the chain (omit for genesis)
 * @returns New DOT with chain base populated
 *
 * @example
 * // Genesis DOT
 * const genesis = chain(observe('first event'));
 * // genesis.chain.depth === 0
 * // genesis.chain.previous === 32 zero bytes
 *
 * @example
 * // Chained DOT
 * const second = chain(observe('second event'), genesis);
 * // second.chain.depth === 1
 * // second.chain.previous === hash(genesis)
 */
export function chain(dot: DOT, previous?: DOT): DOT {
  if (previous === undefined) {
    // Genesis DOT
    return {
      ...dot,
      chain: {
        ...dot.chain,
        previous: GENESIS_HASH,
        depth: 0,
      },
    };
  }

  const prevHash = hash(previous);
  const prevDepth = previous.chain?.depth ?? 0;

  return {
    ...dot,
    chain: {
      ...dot.chain,
      previous: prevHash,
      depth: prevDepth + 1,
    },
  };
}
