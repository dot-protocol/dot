/**
 * replicator.ts — Chain replication over mesh.
 *
 * ChainReplicator bridges @dot-protocol/chain and @dot-protocol/mesh:
 *   1. Listens for incoming DOTs on the mesh node → appends to local chain
 *   2. Periodically broadcasts the local tip hash to peers (heartbeat)
 *   3. When a peer's tip differs → requests missing DOTs → CRDT merges
 */

import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { append, walk, dotHashToHex, merge, detectFork, createChain, tip } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';
import type { MeshNode } from '@dot-protocol/mesh';

/** Conflict resolution strategy when a fork is detected. */
export type ConflictStrategy = 'merge' | 'prefer-local' | 'prefer-remote';

/** Configuration for ChainReplicator. */
export interface ReplicatorConfig {
  /** The local chain to replicate. */
  chain: Chain;
  /** The mesh node used for transport. */
  node: MeshNode;
  /** How often (ms) to broadcast local tip hash to peers. Default: 5000. */
  syncIntervalMs?: number;
  /** How to handle forks between local and remote chains. Default: 'merge'. */
  onConflict?: ConflictStrategy;
}

/** Result of a single sync operation. */
export interface SyncResult {
  dotsReceived: number;
  dotsSent: number;
  merged: boolean;
  conflicts: number;
  duration_ms: number;
}

/** Current status of the replicator. */
export interface ReplicatorStatus {
  running: boolean;
  peers: number;
  lastSync: number | null;
  localTip: string | null;
  remoteTips: Map<string, string>;
}

/**
 * Replicates a Chain across mesh peers using gossip and CRDT merge.
 *
 * @example
 * ```ts
 * const replicator = new ChainReplicator({ chain, node });
 * replicator.start();
 * // ... later ...
 * replicator.stop();
 * ```
 */
export class ChainReplicator {
  private chain: Chain;
  private readonly node: MeshNode;
  private readonly syncIntervalMs: number;
  private readonly conflictStrategy: ConflictStrategy;

  private running = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastSync: number | null = null;

  /** Map of peerId → tip hash they last reported. */
  private readonly remoteTips = new Map<string, string>();

  private readonly syncHandlers: Array<(result: SyncResult) => void> = [];

  constructor(config: ReplicatorConfig) {
    this.chain = config.chain;
    this.node = config.node;
    this.syncIntervalMs = config.syncIntervalMs ?? 5000;
    this.conflictStrategy = config.onConflict ?? 'merge';

    // Listen for DOTs arriving from peers
    this.node.onDot((dot, from) => {
      this.handleIncomingDot(dot, from);
    });
  }

  /**
   * Start replication: begin periodic sync heartbeat.
   * Safe to call multiple times — only starts once.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    this.intervalHandle = setInterval(() => {
      void this.sync();
    }, this.syncIntervalMs);
  }

  /**
   * Stop replication: cancel the periodic sync heartbeat.
   * Safe to call multiple times.
   */
  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Manually trigger a sync round:
   *   1. Broadcast local tip hash to all peers
   *   2. Request DOTs missing from local chain
   *   3. CRDT merge if forks detected
   *
   * @returns SyncResult with counts and timing.
   */
  async sync(): Promise<SyncResult> {
    const start = Date.now();
    let dotsReceived = 0;
    let dotsSent = 0;
    let merged = false;
    let conflicts = 0;

    // Broadcast all local DOTs to peers so they can catch up
    const localDots = walk(this.chain);
    for (const dot of localDots) {
      const sent = await this.node.broadcast(dot);
      if (sent > 0) dotsSent++;
    }

    // For each remote tip we know about, check if we need to merge
    for (const [_peerId, remoteTipHash] of this.remoteTips) {
      if (remoteTipHash === this.chain.tipHash) continue;

      // Try to fetch the remote tip DOT
      const remoteTipDot = await this.node.request(remoteTipHash);
      if (remoteTipDot === null) continue;

      // Build a remote chain view from DOTs we can reach
      const remoteChain = await this.buildRemoteChain(remoteTipHash);
      if (remoteChain === null) continue;

      // Detect and handle fork
      const fork = detectFork(this.chain, remoteChain);
      if (fork.forked) {
        conflicts++;

        if (this.conflictStrategy === 'merge') {
          const beforeTip = this.chain.tipHash;
          this.chain = merge(this.chain, remoteChain);
          if (this.chain.tipHash !== beforeTip) {
            merged = true;
          }
        } else if (this.conflictStrategy === 'prefer-remote') {
          this.chain = remoteChain;
          merged = true;
        }
        // 'prefer-local' → do nothing, keep local chain
      } else {
        // No fork: if remote is longer, adopt it
        const remoteDepth = remoteChain.appendCount;
        const localDepth = this.chain.appendCount;
        if (remoteDepth > localDepth) {
          // Count new DOTs
          const newDots = walk(remoteChain).slice(localDepth);
          dotsReceived += newDots.length;
          this.chain = remoteChain;
          merged = true;
        }
      }
    }

    const result: SyncResult = {
      dotsReceived,
      dotsSent,
      merged,
      conflicts,
      duration_ms: Date.now() - start,
    };

    this.lastSync = Date.now();
    this.notifySyncHandlers(result);
    return result;
  }

  /**
   * Subscribe to sync events. Returns an unsubscribe function.
   */
  onSync(handler: (result: SyncResult) => void): () => void {
    this.syncHandlers.push(handler);
    return () => {
      const idx = this.syncHandlers.indexOf(handler);
      if (idx >= 0) this.syncHandlers.splice(idx, 1);
    };
  }

  /**
   * Current status of the replicator.
   */
  status(): ReplicatorStatus {
    return {
      running: this.running,
      peers: this.node.peers.size,
      lastSync: this.lastSync,
      localTip: this.chain.tipHash,
      remoteTips: new Map(this.remoteTips),
    };
  }

  /**
   * Get the current local chain (may have changed after merges).
   */
  getChain(): Chain {
    return this.chain;
  }

  // --- private ---

  /** Handle an incoming DOT from the mesh. */
  private handleIncomingDot(dot: DOT, from: string): void {
    const hash = dotHashToHex(dot);

    // Check if this looks like a tip announcement (small plaintext DOT)
    if (dot.payload_mode === 'plain' && dot.payload !== undefined) {
      const text = new TextDecoder().decode(dot.payload);
      if (text.startsWith('tip:') && text.length === 68) {
        const tipHash = text.slice(4);
        if (/^[0-9a-f]{64}$/.test(tipHash)) {
          this.remoteTips.set(from, tipHash);
          return;
        }
      }
    }

    // Otherwise treat as a regular DOT to append
    if (!this.chain.storage.has(hash)) {
      try {
        this.chain = append(this.chain, dot);
      } catch {
        // If append fails (e.g., chain linkage issue), just store the DOT
        this.chain.storage.put(dot, hash);
      }
    }
  }

  /**
   * Build a remote chain by walking backward from the given tip hash,
   * requesting DOTs we don't have locally.
   */
  private async buildRemoteChain(tipHash: string): Promise<Chain | null> {
    // Collect all hashes we need to build the chain
    const collected: DOT[] = [];
    let currentHash: string | null = tipHash;

    while (currentHash !== null) {
      // Check local storage first
      let dot = this.chain.storage.get(currentHash);
      if (dot === null) {
        // Request from peers
        dot = await this.node.request(currentHash);
        if (dot === null) break;
      }

      collected.unshift(dot); // prepend to get root-first order

      const prev = dot.chain?.previous;
      if (prev === undefined) break;

      const isGenesis = prev.every((b) => b === 0);
      if (isGenesis) break;

      const prevHash = Buffer.from(prev).toString('hex');
      if (prevHash === currentHash) break; // safety
      currentHash = prevHash;
    }

    if (collected.length === 0) return null;

    // Build a chain from the collected DOTs
    let remoteChain = createChain();
    for (const dot of collected) {
      const { chain: _c, ...stripped } = dot;
      remoteChain = append(remoteChain, stripped);
    }

    return remoteChain;
  }

  private notifySyncHandlers(result: SyncResult): void {
    for (const handler of this.syncHandlers) {
      handler(result);
    }
  }
}
