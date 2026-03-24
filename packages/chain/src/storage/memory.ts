/**
 * MemoryStorage — in-process Map-backed StorageBackend.
 *
 * Zero dependencies. Fastest option for tests and ephemeral chains.
 */

import type { DOT } from '@dot-protocol/core';
import type { StorageBackend, ListOptions } from './interface.js';

interface MemoryEntry {
  dot: DOT;
  depth: number;
  timestamp: number;
}

export class MemoryStorage implements StorageBackend {
  readonly name = 'memory';
  private readonly store = new Map<string, MemoryEntry>();

  get(hash: string): DOT | null {
    const entry = this.store.get(hash);
    return entry !== undefined ? entry.dot : null;
  }

  put(dot: DOT, hash: string, meta?: { depth?: number; timestamp?: number }): void {
    this.store.set(hash, {
      dot,
      depth: meta?.depth ?? dot.chain?.depth ?? 0,
      timestamp: meta?.timestamp ?? dot.time?.utc ?? 0,
    });
  }

  has(hash: string): boolean {
    return this.store.has(hash);
  }

  list(opts?: ListOptions): DOT[] {
    let entries = Array.from(this.store.values());

    if (opts?.type !== undefined) {
      const t = opts.type;
      entries = entries.filter((e) => e.dot.type === t);
    }

    if (opts?.minDepth !== undefined) {
      const min = opts.minDepth;
      entries = entries.filter((e) => e.depth >= min);
    }

    if (opts?.maxDepth !== undefined) {
      const max = opts.maxDepth;
      entries = entries.filter((e) => e.depth <= max);
    }

    if (opts?.since !== undefined) {
      const since = opts.since;
      entries = entries.filter((e) => {
        const ts = e.dot.time?.utc;
        return ts !== undefined && ts >= since;
      });
    }

    if (opts?.until !== undefined) {
      const until = opts.until;
      entries = entries.filter((e) => {
        const ts = e.dot.time?.utc;
        return ts !== undefined && ts <= until;
      });
    }

    if (opts?.observer !== undefined) {
      const obs = opts.observer;
      entries = entries.filter((e) => {
        const pk = e.dot.sign?.observer;
        if (pk === undefined) return false;
        return Buffer.from(pk).toString('hex') === obs;
      });
    }

    let dots = entries.map((e) => e.dot);

    if (opts?.limit !== undefined && opts.limit > 0) {
      dots = dots.slice(0, opts.limit);
    }

    return dots;
  }

  count(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
