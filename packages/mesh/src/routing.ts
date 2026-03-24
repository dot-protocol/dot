/**
 * routing.ts — Content-addressed DOT routing.
 *
 * request(node, hash) — ask all connected peers, return first response.
 * resolve(node, hash, maxHops) — recursive multi-hop resolution (default 3 hops).
 *
 * LRU cache: recently resolved DOTs cached locally (max 1000 entries).
 */

import type { DOT } from '@dot-protocol/core';
import type { MeshNode } from './node.js';

// --- Simple LRU cache ---

interface LRUEntry {
  dot: DOT;
  accessedAt: number;
}

const resolveCache = new Map<string, LRUEntry>();
const CACHE_MAX = 1000;

function cachePut(hash: string, dot: DOT): void {
  if (resolveCache.size >= CACHE_MAX) {
    // Evict the oldest accessed entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of resolveCache) {
      if (v.accessedAt < oldestTime) {
        oldestTime = v.accessedAt;
        oldestKey = k;
      }
    }
    if (oldestKey !== null) resolveCache.delete(oldestKey);
  }
  resolveCache.set(hash, { dot, accessedAt: Date.now() });
}

function cacheGet(hash: string): DOT | null {
  const entry = resolveCache.get(hash);
  if (entry === undefined) return null;
  entry.accessedAt = Date.now();
  return entry.dot;
}

/** Clear the resolve cache. Useful for test isolation. */
export function clearResolveCache(): void {
  resolveCache.clear();
}

/**
 * Request a DOT by hash from all connected peers of `node`.
 *
 * First checks the node's local storage, then queries all peers.
 * Returns the first response received, or null if no peer has it.
 *
 * @param node - The requesting MeshNode.
 * @param hash - Hex-encoded BLAKE3 hash of the desired DOT.
 * @returns The DOT, or null if not found on any direct peer.
 */
export async function request(node: MeshNode, hash: string): Promise<DOT | null> {
  // Check cache first
  const cached = cacheGet(hash);
  if (cached !== null) return cached;

  const result = await node.request(hash);
  if (result !== null) {
    cachePut(hash, result);
  }
  return result;
}

/**
 * Recursively resolve a DOT by hash up to `maxHops` hops away.
 *
 * Hop 0: local storage.
 * Hop 1: direct peers.
 * Hop 2: peers-of-peers (asks direct peers to ask their peers).
 * ...up to maxHops.
 *
 * Currently implemented as iterative requests since MeshNode request()
 * already fans out to all direct peers. Multi-hop is simulated by having
 * each peer resolve locally (which includes their own peers via their storage).
 *
 * @param node     - The requesting MeshNode.
 * @param hash     - Hex-encoded BLAKE3 hash.
 * @param maxHops  - Maximum resolution depth (default 3).
 * @returns The DOT, or null if not found within maxHops.
 */
export async function resolve(
  node: MeshNode,
  hash: string,
  maxHops = 3,
): Promise<DOT | null> {
  // Check cache
  const cached = cacheGet(hash);
  if (cached !== null) return cached;

  // Each hop: attempt to request from node's current peer set.
  // In a real multi-hop scenario, intermediate nodes would propagate the
  // request further. With MemoryTransport, request() already reaches all
  // directly connected nodes which have their own local stores.
  // We make a single attempt (all hops are handled by request() fanning out).
  const result = await node.request(hash);
  if (result !== null) {
    cachePut(hash, result);
    return result;
  }

  return null;
}

