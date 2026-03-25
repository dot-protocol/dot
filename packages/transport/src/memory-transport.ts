/**
 * memory-transport.ts — In-memory DotTransport implementation for testing.
 *
 * Implements DotTransport using the existing mesh MemoryTransport + chain
 * MemoryStorage. No network I/O, no Rust FFI — runs entirely in-process.
 *
 * Use this for:
 *   - Unit tests
 *   - Local development without iroh runtime
 *   - Performance benchmarks
 *
 * Production equivalent: IrohDotTransport (iroh-transport.ts)
 */

import { toBytes, fromBytes } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createChain, append, walk, dotHashToHex } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';
import { MemoryHub, MemoryTransport, createNode } from '@dot-protocol/mesh';
import type { MeshNode } from '@dot-protocol/mesh';

import type {
  DotTransport,
  RoomHandle,
  SyncStatus,
  Unsubscribe,
} from './interface.js';

/**
 * Shared hub registry — allows multiple MemoryDotTransport instances
 * in the same process to communicate with each other via a named hub.
 *
 * Pass the same MemoryTransportHub to multiple MemoryDotTransport
 * constructors to simulate a multi-peer network.
 */
export class MemoryTransportHub {
  readonly _hub: MemoryHub;
  /** Map of roomName → set of nodeIds that joined it. */
  private readonly _rooms = new Map<string, Set<string>>();
  /** Map of roomName → room ID (stable namespace identifier). */
  private readonly _roomIds = new Map<string, string>();
  /** Map of roomName → list of subscribers (nodeId → handler). */
  private readonly _subscribers = new Map<string, Map<string, (dot: DOT) => void>>();
  /** Map of roomName → DOT store (all DOTs ever published). */
  readonly _dotStore = new Map<string, DOT[]>();

  constructor(latencyMs = 0) {
    this._hub = new MemoryHub(latencyMs);
  }

  /** Register or look up a room. Returns the stable room ID. */
  registerRoom(name: string): string {
    if (!this._roomIds.has(name)) {
      const id = generateRoomId(name);
      this._roomIds.set(name, id);
      this._rooms.set(name, new Set());
      this._subscribers.set(name, new Map());
      this._dotStore.set(name, []);
    }
    return this._roomIds.get(name)!;
  }

  /** Record a node joining a room. */
  joinRoom(name: string, nodeId: string): void {
    this.registerRoom(name);
    this._rooms.get(name)!.add(nodeId);
  }

  /** Record a node leaving a room. */
  leaveRoom(name: string, nodeId: string): void {
    this._rooms.get(name)?.delete(nodeId);
  }

  /** Return member count for a room. */
  memberCount(name: string): number {
    return this._rooms.get(name)?.size ?? 0;
  }

  /** Return DOT count for a room. */
  dotCount(name: string): number {
    return this._dotStore.get(name)?.length ?? 0;
  }

  /** Return all room names. */
  roomNames(): string[] {
    return Array.from(this._roomIds.keys());
  }

  /** Return room ID for a given name (undefined if not registered). */
  roomId(name: string): string | undefined {
    return this._roomIds.get(name);
  }

  /**
   * Store a DOT in a room and fan it out to all subscribers except the publisher.
   */
  publish(roomName: string, dot: DOT, publisherNodeId: string): void {
    const store = this._dotStore.get(roomName);
    if (store === undefined) return;
    store.push(dot);

    const subs = this._subscribers.get(roomName);
    if (subs === undefined) return;
    for (const [nodeId, handler] of subs) {
      if (nodeId !== publisherNodeId) {
        handler(dot);
      }
    }
  }

  /** Register a subscriber for a room. Returns an Unsubscribe function. */
  subscribe(roomName: string, nodeId: string, handler: (dot: DOT) => void): Unsubscribe {
    this.registerRoom(roomName);
    const subs = this._subscribers.get(roomName)!;
    subs.set(nodeId, handler);
    return () => {
      subs.delete(nodeId);
    };
  }

  /** Return all DOTs stored in a room. */
  getDots(roomName: string): DOT[] {
    return this._dotStore.get(roomName) ?? [];
  }
}

/** Deterministic but unique room ID from name. */
function generateRoomId(name: string): string {
  // Simple deterministic hash: encode name bytes as hex + suffix
  const bytes = new TextEncoder().encode(name);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Pad/truncate to 64 chars to look like a real namespace ID
  return (hex + '0'.repeat(64)).slice(0, 64);
}

/** Generate a random node ID (simulates Ed25519 public key). */
function generateNodeId(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * In-memory DotTransport implementation.
 *
 * Simulates the full DotTransport interface without any network I/O.
 * Multiple instances sharing a MemoryTransportHub can exchange DOTs
 * as if they were peers on a real network.
 */
export class MemoryDotTransport implements DotTransport {
  private readonly _nodeId: string;
  private readonly _hub: MemoryTransportHub;
  /** Map of roomName → sync status snapshot. */
  private readonly _syncStatus = new Map<string, SyncStatus>();
  /** Set of connected peer IDs. */
  private readonly _peers = new Set<string>();
  private _shutdown = false;

  /**
   * @param hub     - Shared hub for multi-peer communication.
   *                  Use a single MemoryTransportHub across all nodes
   *                  that should be able to communicate.
   * @param nodeId  - Optional fixed node ID (defaults to a random 32-byte hex string).
   */
  constructor(hub: MemoryTransportHub, nodeId?: string) {
    this._hub = hub;
    this._nodeId = nodeId ?? generateNodeId();
  }

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  nodeId(): string {
    return this._nodeId;
  }

  // -------------------------------------------------------------------------
  // Room operations
  // -------------------------------------------------------------------------

  async createRoom(name: string): Promise<RoomHandle> {
    this._assertAlive();
    const id = this._hub.registerRoom(name);
    this._hub.joinRoom(name, this._nodeId);
    this._initSyncStatus(name);
    return this._buildHandle(name, id);
  }

  async joinRoom(name: string, _ticket?: string): Promise<RoomHandle> {
    this._assertAlive();
    // For MemoryDotTransport, ticket is ignored — rooms are found by name via hub
    const id = this._hub.registerRoom(name);
    this._hub.joinRoom(name, this._nodeId);
    this._initSyncStatus(name);
    // On join, pull all existing DOTs from the hub (catch-up sync)
    const existing = this._hub.getDots(name);
    const status = this._syncStatus.get(name)!;
    status.localDots = existing.length;
    status.remoteDots = existing.length;
    status.pendingSync = 0;
    status.synced = true;
    status.lastSyncMs = Date.now();
    return this._buildHandle(name, id);
  }

  async listRooms(): Promise<string[]> {
    this._assertAlive();
    return this._hub.roomNames();
  }

  // -------------------------------------------------------------------------
  // DOT operations
  // -------------------------------------------------------------------------

  async publishDot(room: RoomHandle, dot: DOT): Promise<void> {
    this._assertAlive();
    this._hub.publish(room.name, dot, this._nodeId);
    // Update local sync status
    const status = this._syncStatus.get(room.name);
    if (status !== undefined) {
      status.localDots = this._hub.dotCount(room.name);
      status.remoteDots = status.localDots;
      status.pendingSync = 0;
      status.synced = true;
    }
  }

  subscribeDots(room: RoomHandle, handler: (dot: DOT) => void): Unsubscribe {
    this._assertAlive();
    return this._hub.subscribe(room.name, this._nodeId, handler);
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  async sync(room: RoomHandle): Promise<SyncStatus> {
    this._assertAlive();
    const totalDots = this._hub.dotCount(room.name);
    const status: SyncStatus = {
      synced: true,
      localDots: totalDots,
      remoteDots: totalDots,
      pendingSync: 0,
      lastSyncMs: Date.now(),
    };
    this._syncStatus.set(room.name, status);
    return status;
  }

  getSyncStatus(room: RoomHandle): SyncStatus {
    const status = this._syncStatus.get(room.name);
    if (status === undefined) {
      return {
        synced: false,
        localDots: 0,
        remoteDots: 0,
        pendingSync: 0,
        lastSyncMs: 0,
      };
    }
    // Refresh counts from hub
    const totalDots = this._hub.dotCount(room.name);
    return { ...status, localDots: totalDots, remoteDots: totalDots };
  }

  // -------------------------------------------------------------------------
  // Peer management
  // -------------------------------------------------------------------------

  async connectPeer(peerId: string): Promise<void> {
    this._assertAlive();
    this._peers.add(peerId);
  }

  disconnectPeer(peerId: string): void {
    this._peers.delete(peerId);
  }

  connectedPeers(): string[] {
    return Array.from(this._peers);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async shutdown(): Promise<void> {
    this._shutdown = true;
    this._peers.clear();
    // Leave all rooms
    for (const name of this._hub.roomNames()) {
      this._hub.leaveRoom(name, this._nodeId);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _assertAlive(): void {
    if (this._shutdown) {
      throw new Error('MemoryDotTransport: transport has been shut down');
    }
  }

  private _initSyncStatus(name: string): void {
    if (!this._syncStatus.has(name)) {
      this._syncStatus.set(name, {
        synced: false,
        localDots: 0,
        remoteDots: 0,
        pendingSync: 0,
        lastSyncMs: 0,
      });
    }
  }

  private _buildHandle(name: string, id: string): RoomHandle {
    return {
      name,
      id,
      memberCount: this._hub.memberCount(name),
      dotCount: this._hub.dotCount(name),
    };
  }
}
