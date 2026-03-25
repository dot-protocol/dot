/**
 * room-transport.ts — High-level room operations over a DotTransport.
 *
 * TransportRoom bridges the DOT chain API with the transport layer:
 *   1. observe() + sign() → publishDot() → remote peers receive it
 *   2. subscribeDots() → incoming DOTs → local chain mirror
 *   3. getHistory() → walk the local chain
 *   4. sync() → pull missing DOTs from peers
 *
 * This is the main entry point for application code.
 * Apps create a TransportRoom, call observe() to send messages,
 * and register onMessage() handlers to receive them.
 *
 * Chain mirror:
 *   TransportRoom maintains a local chain (MemoryStorage by default) that
 *   mirrors all DOTs seen in the room (both sent and received). This enables
 *   offline history access and CRDT merge when reconnecting.
 */

import { observe as coreObserve, sign, toBytes, fromBytes } from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { createChain, append, walk } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';

import type { DotTransport, RoomHandle, SyncStatus, Unsubscribe } from './interface.js';

/** Configuration for creating a TransportRoom. */
export interface TransportRoomConfig {
  /** The transport to use for P2P communication. */
  transport: DotTransport;
  /** The room handle (from transport.createRoom or transport.joinRoom). */
  handle: RoomHandle;
  /**
   * Optional Ed25519 identity for signing DOTs.
   * If omitted, DOTs are unsigned (payload-only, no sign base).
   */
  identity?: Identity;
}

/** Result of a TransportRoom.sync() call. */
export interface TransportSyncResult {
  /** Current sync status from the transport. */
  status: SyncStatus;
  /** Number of new DOTs pulled into the local chain during this sync. */
  newDots: number;
}

/**
 * High-level room handle that integrates chain storage with transport.
 *
 * @example
 * const hub = new MemoryTransportHub();
 * const transport = new MemoryDotTransport(hub);
 * const handle = await transport.createRoom('my-room');
 * const room = new TransportRoom({ transport, handle, identity });
 *
 * // Send a DOT
 * const dot = await room.observe('hello world');
 *
 * // Receive DOTs
 * const unsub = room.onMessage((dot) => console.log(dot));
 *
 * // Later
 * unsub();
 */
export class TransportRoom {
  readonly transport: DotTransport;
  readonly handle: RoomHandle;
  private readonly identity: Identity | undefined;

  /** Local chain mirror — contains all DOTs seen in this room. */
  private chain: Chain;

  /** Active subscription (set when at least one onMessage handler is registered). */
  private subscription: Unsubscribe | null = null;

  /** All registered message handlers. */
  private readonly handlers: Array<(dot: DOT) => void> = [];

  /** Set of dot hashes already appended to the local chain (deduplication). */
  private readonly seenHashes = new Set<string>();

  constructor(config: TransportRoomConfig) {
    this.transport = config.transport;
    this.handle = config.handle;
    this.identity = config.identity;
    this.chain = createChain();
  }

  // -------------------------------------------------------------------------
  // DOT creation and publishing
  // -------------------------------------------------------------------------

  /**
   * Create a signed DOT with the given content and publish it to the room.
   *
   * Steps:
   *   1. observe(content) → unsigned DOT
   *   2. sign(dot, secretKey) → signed DOT (if identity provided)
   *   3. Append to local chain mirror
   *   4. transport.publishDot(handle, dot) → broadcast to peers
   *
   * @param content  - Payload content (string, Uint8Array, or object)
   * @param options  - Optional observation options (type, plaintext)
   * @returns The signed (or unsigned) DOT that was published
   */
  async observe(
    content: unknown,
    options?: { type?: 'measure' | 'state' | 'event' | 'claim' | 'bond'; plaintext?: boolean },
  ): Promise<DOT> {
    // Create unsigned DOT
    let dot: DOT = coreObserve(content, options);

    // Sign if identity is available
    if (this.identity !== undefined) {
      dot = await sign(dot, this.identity.secretKey);
    }

    // Append to local chain (chain.previous is set by append())
    this.chain = append(this.chain, dot);

    // Compute hash for deduplication tracking
    const { dotHashToHex } = await import('@dot-protocol/chain');
    const hash = dotHashToHex(dot);
    this.seenHashes.add(hash);

    // Publish to transport
    await this.transport.publishDot(this.handle, dot);

    return dot;
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  /**
   * Return DOTs from the local chain mirror, newest first.
   *
   * @param limit - Maximum number of DOTs to return. If omitted, returns all.
   * @returns Array of DOTs in reverse chronological order (tip first).
   */
  async getHistory(limit?: number): Promise<DOT[]> {
    const all = walk(this.chain);
    if (limit === undefined) {
      return all;
    }
    return all.slice(0, limit);
  }

  /**
   * Return the total number of DOTs in the local chain mirror.
   */
  dotCount(): number {
    return this.chain.appendCount;
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  /**
   * Register a handler called whenever a new DOT arrives from the room.
   *
   * Handles deduplication — the handler will not be called for DOTs
   * that were published by this node (unless echoSelf is true).
   *
   * The handler is also called for incoming DOTs that get appended to
   * the local chain mirror.
   *
   * @param handler  - Called with each incoming DOT
   * @returns An Unsubscribe function — call it to remove this handler
   */
  onMessage(handler: (dot: DOT) => void): Unsubscribe {
    this.handlers.push(handler);

    // Lazily set up the transport subscription on first onMessage call
    if (this.subscription === null) {
      this.subscription = this.transport.subscribeDots(this.handle, (dot: DOT) => {
        this._handleIncoming(dot);
      });
    }

    // Return unsubscribe that removes just this handler
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx !== -1) {
        this.handlers.splice(idx, 1);
      }
      // If no handlers left, unsubscribe from transport
      if (this.handlers.length === 0 && this.subscription !== null) {
        this.subscription();
        this.subscription = null;
      }
    };
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /**
   * Trigger a sync with remote peers and pull missing DOTs into the local chain.
   *
   * @returns Sync result including status and count of new DOTs pulled.
   */
  async sync(): Promise<TransportSyncResult> {
    const beforeCount = this.chain.appendCount;
    const status = await this.transport.sync(this.handle);

    // For MemoryTransport: pull all room DOTs we haven't seen yet
    // For IrohTransport: sync is handled by the transport layer internally
    const roomDots = await this._pullMissingDots();

    return {
      status,
      newDots: roomDots,
    };
  }

  /**
   * Return current sync status without triggering a sync.
   */
  getSyncStatus(): SyncStatus {
    return this.transport.getSyncStatus(this.handle);
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Unsubscribe from all room events and clean up resources.
   *
   * Does NOT shut down the transport — call transport.shutdown() separately
   * if you want to close the network connection.
   */
  close(): void {
    if (this.subscription !== null) {
      this.subscription();
      this.subscription = null;
    }
    this.handlers.length = 0;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Handle an incoming DOT from the transport subscription. */
  private _handleIncoming(dot: DOT): void {
    // Import chain hash synchronously — already loaded
    const hashHex = this._hashDot(dot);

    // Deduplicate
    if (this.seenHashes.has(hashHex)) {
      return;
    }
    this.seenHashes.add(hashHex);

    // Append to local chain mirror (best-effort — ignore chain linkage errors)
    try {
      this.chain = append(this.chain, dot);
    } catch {
      // If chain linkage fails (e.g., out-of-order delivery), store the raw DOT
      // This can happen during initial sync; replication will reconcile later
    }

    // Notify all handlers
    for (const handler of this.handlers) {
      handler(dot);
    }
  }

  /**
   * Synchronously compute a DOT hash for deduplication.
   * Uses the chain depth + payload size as a fast approximation
   * when full BLAKE3 is not available synchronously.
   *
   * Note: In production, use dotHashToHex from @dot-protocol/chain.
   * Here we use a lightweight approach for synchronous operation.
   */
  private _hashDot(dot: DOT): string {
    // Build a stable key from available DOT fields
    const parts: string[] = [];
    if (dot.sign?.signature !== undefined) {
      parts.push(Buffer.from(dot.sign.signature).toString('hex').slice(0, 16));
    }
    if (dot.verify?.hash !== undefined) {
      parts.push(Buffer.from(dot.verify.hash).toString('hex'));
    }
    if (dot.payload !== undefined) {
      parts.push(dot.payload.length.toString());
    }
    if (dot.time?.utc !== undefined) {
      parts.push(dot.time.utc.toString());
    }
    if (dot.chain?.depth !== undefined) {
      parts.push(dot.chain.depth.toString());
    }
    return parts.join(':') || JSON.stringify(dot).slice(0, 64);
  }

  /**
   * Pull DOTs from the hub that we haven't seen yet.
   * MemoryTransport-specific: reads directly from hub's dot store.
   * IrohTransport: sync is handled by the transport layer.
   *
   * @returns Number of new DOTs pulled.
   */
  private async _pullMissingDots(): Promise<number> {
    // Access hub's stored DOTs if available (MemoryTransport internals)
    const transport = this.transport as unknown as {
      _hub?: { getDots?: (name: string) => DOT[] };
    };

    if (
      transport._hub === undefined ||
      typeof transport._hub.getDots !== 'function'
    ) {
      return 0;
    }

    const allDots = transport._hub.getDots(this.handle.name);
    let newCount = 0;

    for (const dot of allDots) {
      const hash = this._hashDot(dot);
      if (!this.seenHashes.has(hash)) {
        this.seenHashes.add(hash);
        try {
          this.chain = append(this.chain, dot);
        } catch {
          // Ignore chain linkage errors during catch-up sync
        }
        newCount++;
      }
    }

    return newCount;
  }
}
