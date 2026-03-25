/**
 * offline.ts — Offline-first DOT queue.
 *
 * OfflineQueue lets you append DOTs to a local chain immediately (no network
 * required). When connectivity returns, call flush() to broadcast all pending
 * DOTs to mesh peers.
 *
 * "Offline" means: no peers connected to the mesh node.
 */

import { append, walk, dotHashToHex } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';
import type { DOT } from '@dot-protocol/core';
import type { MeshNode } from '@dot-protocol/mesh';

/** Result of a flush operation. */
export interface FlushResult {
  flushed: number;
  failed: number;
  duration_ms: number;
}

/**
 * Offline-first queue built on top of a Chain.
 *
 * DOTs are appended locally (works with zero peers). When connectivity
 * is restored, flush() broadcasts all stored DOTs to available peers.
 *
 * @example
 * ```ts
 * const queue = new OfflineQueue(chain);
 * queue.enqueue(observe('hello', { plaintext: true }));
 * // ... connectivity restored ...
 * await queue.flush(node);
 * ```
 */
export class OfflineQueue {
  private chain: Chain;
  /** Set of hashes we've enqueued (haven't confirmed broadcast yet). */
  private readonly pendingHashes = new Set<string>();
  /** Set of hashes successfully broadcast. */
  private readonly flushedHashes = new Set<string>();

  constructor(chain: Chain) {
    this.chain = chain;
  }

  /**
   * Append a DOT to the local chain immediately.
   * Works offline — no peers required.
   * The DOT is recorded as pending until flush() broadcasts it.
   */
  enqueue(dot: DOT): void {
    this.chain = append(this.chain, dot);
    if (this.chain.tipHash !== null) {
      this.pendingHashes.add(this.chain.tipHash);
    }
  }

  /**
   * Broadcast all pending DOTs to peers via the mesh node.
   * Only sends DOTs that haven't been successfully flushed yet.
   *
   * @param node - The mesh node to use for broadcasting.
   * @returns FlushResult with counts and timing.
   */
  async flush(node: MeshNode): Promise<FlushResult> {
    const start = Date.now();
    let flushed = 0;
    let failed = 0;

    if (!this.isOnline(node)) {
      return { flushed: 0, failed: 0, duration_ms: Date.now() - start };
    }

    // Walk the chain to get all DOTs in order, broadcast pending ones
    const allDots = walk(this.chain);

    for (const dot of allDots) {
      const hash = dotHashToHex(dot);
      if (!this.pendingHashes.has(hash)) continue;
      if (this.flushedHashes.has(hash)) continue;

      try {
        const sent = await node.broadcast(dot);
        if (sent > 0) {
          this.flushedHashes.add(hash);
          this.pendingHashes.delete(hash);
          flushed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return { flushed, failed, duration_ms: Date.now() - start };
  }

  /**
   * Number of DOTs that have been enqueued but not yet flushed.
   */
  pending(): number {
    return this.pendingHashes.size;
  }

  /**
   * True if the mesh node has at least one connected peer.
   */
  isOnline(node: MeshNode): boolean {
    return node.peers.size > 0;
  }

  /**
   * Get the underlying chain (may have had DOTs appended via enqueue).
   */
  getChain(): Chain {
    return this.chain;
  }
}
