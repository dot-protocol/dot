/**
 * broadcast.ts — Fan-out DOT broadcasting across all connected peers.
 *
 * broadcast(node, dot) sends the DOT to every peer, returns the count reached.
 * Deduplication is handled inside MeshNode (seenHashes Set) — nodes that already
 * have the hash will silently drop re-delivered messages.
 */

import type { DOT } from '@dot-protocol/core';
import type { MeshNode } from './node.js';

/**
 * Broadcast a DOT to all peers connected to `node`.
 *
 * @param node - The source MeshNode.
 * @param dot  - The DOT to broadcast.
 * @returns Number of peers that successfully received the message.
 */
export async function broadcast(node: MeshNode, dot: DOT): Promise<number> {
  return node.broadcast(dot);
}
