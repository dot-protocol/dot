/**
 * query.ts — Query helpers for DOT chains.
 *
 * All query functions operate through the chain's StorageBackend,
 * which supports filtering via ListOptions.
 */

import type { DOT, ObservationType } from '@dot-protocol/core';
import type { Chain } from './dag.js';

/**
 * Retrieve a DOT by its hex hash.
 *
 * @returns The DOT, or null if not found.
 */
export function byHash(chain: Chain, hash: string): DOT | null {
  return chain.storage.get(hash);
}

/**
 * Retrieve all DOTs with time.utc within [start, end] (inclusive).
 *
 * DOTs without a time.utc field are excluded.
 */
export function byTimeRange(chain: Chain, start: number, end: number): DOT[] {
  return chain.storage.list({ since: start, until: end });
}

/**
 * Retrieve all DOTs of a specific observation type.
 */
export function byType(chain: Chain, type: ObservationType): DOT[] {
  return chain.storage.list({ type });
}

/**
 * Retrieve all DOTs signed by a specific observer public key.
 *
 * @param pk - 32-byte Ed25519 public key of the observer
 */
export function byObserver(chain: Chain, pk: Uint8Array): DOT[] {
  const hex = Buffer.from(pk).toString('hex');
  return chain.storage.list({ observer: hex });
}

/**
 * Retrieve all DOTs with chain.depth in [minDepth, maxDepth] (inclusive).
 */
export function byDepthRange(chain: Chain, minDepth: number, maxDepth: number): DOT[] {
  return chain.storage.list({ minDepth, maxDepth });
}
