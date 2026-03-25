/**
 * interface.ts — Universal transport interface that iroh (or any transport) must implement.
 *
 * Abstracts away the networking layer so DOT chain operations are
 * transport-agnostic. The same DOT operations work whether backed by
 * an in-memory hub (tests), iroh P2P (production), or any future transport.
 *
 * DOT Protocol R854 — iroh adapter layer.
 *
 * iroh mapping (github.com/n0-computer/iroh):
 *   - DotTransport.nodeId()      → iroh Endpoint::node_id() (Ed25519 public key)
 *   - DotTransport.createRoom()  → iroh Doc::create() (new iroh-doc namespace)
 *   - DotTransport.joinRoom()    → iroh Doc::join(ticket)
 *   - DotTransport.publishDot()  → iroh doc.set_bytes(key=dot_hash, value=dot_bytes, author=identity)
 *   - DotTransport.subscribeDots() → iroh doc.subscribe() (live event stream)
 *   - DotTransport.sync()        → iroh doc.start_sync(peers)
 *   - DotTransport.connectPeer() → iroh endpoint.connect(node_id)
 */

import type { DOT } from '@dot-protocol/core';

// Re-export DOT so consumers only need to import from this package
export type { DOT };

/**
 * A handle to a named room (iroh: namespace / doc).
 *
 * iroh equivalence:
 *   - name: human-readable label stored in gossip announce
 *   - id: iroh NamespaceId (doc ID) as hex string
 *   - memberCount: connected peers + self
 *   - dotCount: entries in the iroh-doc namespace
 */
export interface RoomHandle {
  /** Human-readable room name (label). */
  name: string;
  /**
   * Namespace/doc ID — globally unique identifier for this room.
   * In iroh: the NamespaceId (32-byte Ed25519 public key), hex-encoded.
   */
  id: string;
  /** Number of connected members including self. */
  memberCount: number;
  /** Total DOTs stored in this room. */
  dotCount: number;
}

/**
 * Sync status snapshot for a room.
 *
 * iroh equivalence:
 *   - synced: all known remote entries have been pulled locally
 *   - localDots: entries in local iroh-doc storage
 *   - remoteDots: entries known from peer announcements
 *   - pendingSync: remoteDots - localDots (approx)
 *   - lastSyncMs: epoch ms of last successful sync operation
 */
export interface SyncStatus {
  /** Whether local and remote are fully in sync. */
  synced: boolean;
  /** DOTs stored locally. */
  localDots: number;
  /** DOTs known to exist remotely (from peer announcements). */
  remoteDots: number;
  /** Approximate number of DOTs waiting to be pulled. */
  pendingSync: number;
  /** Unix ms timestamp of the last completed sync. 0 if never synced. */
  lastSyncMs: number;
}

/**
 * Unsubscribe function returned by subscribeDots.
 * Call it to stop receiving DOTs from a subscription.
 */
export type Unsubscribe = () => void;

/**
 * The universal DOT transport interface.
 *
 * Every transport implementation (MemoryDotTransport, IrohDotTransport, etc.)
 * must satisfy this contract. Upper-layer code (TransportRoom, apps) only
 * depends on this interface — never on a concrete transport.
 *
 * Lifecycle:
 *   1. Instantiate a concrete transport
 *   2. Call createRoom() or joinRoom() to enter a room
 *   3. Use the returned RoomHandle with publishDot() / subscribeDots() / sync()
 *   4. Call shutdown() when done
 */
export interface DotTransport {
  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /**
   * Returns this node's public key as a lowercase hex string.
   *
   * In iroh: iroh Endpoint::node_id() (Ed25519 public key, 32 bytes → 64 hex chars).
   */
  nodeId(): string;

  // -------------------------------------------------------------------------
  // Room (namespace) operations
  // -------------------------------------------------------------------------

  /**
   * Create a new room and return a handle to it.
   *
   * In iroh: iroh Doc::create() creates a new iroh-doc namespace.
   *   The NamespaceId becomes the room's id.
   *
   * @param name - Human-readable room name (used for discovery announcements).
   */
  createRoom(name: string): Promise<RoomHandle>;

  /**
   * Join an existing room.
   *
   * In iroh: iroh Doc::join(ticket) where ticket is an iroh DocTicket
   *   (encodes the NamespaceId + relay URLs + peer addresses).
   *
   * @param name   - Human-readable room name.
   * @param ticket - Optional join ticket (iroh: DocTicket string). If omitted,
   *                 attempts discovery via gossip/DHT.
   */
  joinRoom(name: string, ticket?: string): Promise<RoomHandle>;

  /**
   * List all rooms this node is a member of.
   *
   * In iroh: iterate over all open Docs on the iroh node.
   */
  listRooms(): Promise<string[]>;

  // -------------------------------------------------------------------------
  // DOT operations within a room
  // -------------------------------------------------------------------------

  /**
   * Publish a DOT into a room.
   *
   * In iroh: iroh doc.set_bytes(
   *   author  = this node's AuthorId (derived from Ed25519 identity),
   *   key     = dot_hash_bytes (BLAKE3 hash of the DOT, 32 bytes),
   *   value   = toBytes(dot)   (canonical DOT serialization),
   * )
   *
   * @param room - The room to publish into.
   * @param dot  - The DOT to publish.
   */
  publishDot(room: RoomHandle, dot: DOT): Promise<void>;

  /**
   * Subscribe to incoming DOTs in a room.
   *
   * In iroh: iroh doc.subscribe() returns a live event stream.
   *   On each InsertRemote or InsertLocal event, decode the value as a DOT
   *   and call the handler.
   *
   * @param room    - The room to subscribe to.
   * @param handler - Called with each incoming DOT.
   * @returns An Unsubscribe function — call it to stop listening.
   */
  subscribeDots(room: RoomHandle, handler: (dot: DOT) => void): Unsubscribe;

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /**
   * Trigger a sync for the given room and return the resulting status.
   *
   * In iroh: iroh doc.start_sync(peers) initiates sync with known peers.
   *   Waits for the sync to complete (or timeout) then returns status.
   *
   * @param room - The room to sync.
   */
  sync(room: RoomHandle): Promise<SyncStatus>;

  /**
   * Return the current sync status without triggering a sync.
   *
   * @param room - The room to query.
   */
  getSyncStatus(room: RoomHandle): SyncStatus;

  // -------------------------------------------------------------------------
  // Peer management
  // -------------------------------------------------------------------------

  /**
   * Connect to a remote peer by node ID.
   *
   * In iroh: iroh endpoint.connect(NodeId::from_str(nodeId), ALPN_PROTOCOL)
   *   establishes a QUIC connection with NAT traversal / relay fallback.
   *
   * @param nodeId - Hex-encoded Ed25519 public key of the target peer.
   */
  connectPeer(nodeId: string): Promise<void>;

  /**
   * Disconnect from a peer.
   *
   * In iroh: close the QUIC connection to the given peer.
   *
   * @param nodeId - Hex-encoded Ed25519 public key of the peer to disconnect.
   */
  disconnectPeer(nodeId: string): void;

  /**
   * Return the list of currently connected peer IDs (hex-encoded public keys).
   *
   * In iroh: iroh endpoint.remote_info_iter() filtered to connected peers.
   */
  connectedPeers(): string[];

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Gracefully shut down the transport.
   *
   * In iroh: iroh node.shutdown() — closes all connections, cleans up resources.
   */
  shutdown(): Promise<void>;
}
