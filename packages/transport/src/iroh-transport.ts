/**
 * iroh-transport.ts — Production DotTransport backed by iroh P2P runtime.
 *
 * iroh (github.com/n0-computer/iroh) provides:
 *   - Ed25519 peer identity (same as DOT)
 *   - BLAKE3 content addressing (same as DOT)
 *   - iroh-docs: key-value entries signed by authors, synced across peers
 *   - iroh-gossip: pub-sub overlay for DOT announcements
 *   - iroh-blobs: content-addressed blob transfer for large DOTs
 *   - QUIC with NAT traversal + hole punching + relay fallback
 *
 * DOT-to-iroh semantic mapping:
 *   DOT concept          → iroh primitive
 *   ─────────────────────────────────────────────────────────────────────
 *   DOT observer key     → iroh AuthorId (Ed25519 public key)
 *   DOT hash (BLAKE3)    → iroh-doc entry key (32 bytes → used as key)
 *   DOT bytes            → iroh-doc entry value (toBytes(dot))
 *   room                 → iroh Doc (iroh-docs namespace, NamespaceId)
 *   room ticket          → iroh DocTicket (NamespaceId + relay + addrs)
 *   node identity        → iroh NodeId (Ed25519 public key, same scheme)
 *   peer connection      → iroh QUIC endpoint connection
 *   sync                 → iroh doc.start_sync(peers)
 *   subscribe            → iroh doc.subscribe() event stream
 *
 * Integration options (in order of preference):
 *
 *   Option A: iroh Node.js bindings
 *     When iroh ships official Node.js/WASM bindings, replace the stubs
 *     below with direct calls to the iroh JS API. Watch:
 *     https://github.com/n0-computer/iroh/issues (search "nodejs" / "wasm")
 *
 *   Option B: iroh HTTP control plane
 *     iroh exposes an HTTP API at http://127.0.0.1:11204 (default) with
 *     JSON endpoints for all operations. Start iroh node via CLI:
 *       `iroh start --rpc-addr 127.0.0.1:11204`
 *     Then each method below becomes a fetch() call to the iroh HTTP API.
 *     See: https://docs.iroh.computer/api/
 *
 *   Option C: Rust subprocess with stdio JSON-RPC
 *     Spawn a Rust binary that wraps iroh and speaks JSON-RPC over stdio.
 *     Each method sends a JSON-RPC request and awaits the response.
 *     Example subprocess command: `iroh-dot-bridge --stdio`
 *
 * Status: STUB — every method throws IrohTransportNotConnectedError with
 *   detailed implementation notes for the iroh API call needed.
 */

import type {
  DotTransport,
  RoomHandle,
  SyncStatus,
  Unsubscribe,
} from './interface.js';
import type { DOT } from '@dot-protocol/core';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown by IrohDotTransport when the iroh runtime is not connected.
 *
 * To resolve: connect the iroh runtime via one of the three options
 * described in this file's module comment.
 */
export class IrohTransportNotConnectedError extends Error {
  /** The specific iroh API call that would implement this operation. */
  readonly irohApiCall: string;
  /** Human-readable integration notes. */
  readonly integrationNotes: string;

  constructor(method: string, irohApiCall: string, integrationNotes: string) {
    super(
      `IrohTransport: not yet connected to iroh runtime\n` +
        `  Method:             ${method}\n` +
        `  iroh API call:      ${irohApiCall}\n` +
        `  Integration notes:  ${integrationNotes}`,
    );
    this.name = 'IrohTransportNotConnectedError';
    this.irohApiCall = irohApiCall;
    this.integrationNotes = integrationNotes;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for IrohDotTransport. */
export interface IrohTransportConfig {
  /**
   * iroh HTTP control plane URL.
   * Default: 'http://127.0.0.1:11204'
   * Only used when integration mode is 'http'.
   */
  rpcUrl?: string;

  /**
   * Integration mode.
   *   'http'   — Use iroh's HTTP control plane API
   *   'ffi'    — Use iroh Node.js FFI bindings (not yet available)
   *   'stdio'  — Use a Rust subprocess over stdio JSON-RPC
   *   'stub'   — Stub mode (all methods throw, for testing error paths)
   * Default: 'stub'
   */
  mode?: 'http' | 'ffi' | 'stdio' | 'stub';
}

// ---------------------------------------------------------------------------
// IrohDotTransport
// ---------------------------------------------------------------------------

/**
 * Production DotTransport that delegates to iroh.
 *
 * Currently a documented stub — every method throws
 * IrohTransportNotConnectedError with exact iroh API call details.
 *
 * To wire up real iroh:
 *   1. Start an iroh node: `iroh start --rpc-addr 127.0.0.1:11204`
 *   2. Set mode: 'http' in config
 *   3. Replace stub throws with fetch() calls to iroh HTTP API
 *
 * @example
 * // Stub (default) — use for testing error path behavior
 * const transport = new IrohDotTransport();
 *
 * @example
 * // HTTP mode (when iroh is running locally)
 * const transport = new IrohDotTransport({ mode: 'http', rpcUrl: 'http://127.0.0.1:11204' });
 */
export class IrohDotTransport implements DotTransport {
  private readonly _config: Required<IrohTransportConfig>;

  constructor(config?: IrohTransportConfig) {
    this._config = {
      rpcUrl: config?.rpcUrl ?? 'http://127.0.0.1:11204',
      mode: config?.mode ?? 'stub',
    };
  }

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /**
   * Returns this node's Ed25519 public key as hex.
   *
   * iroh API call:
   *   GET {rpcUrl}/node/id
   *   Response: { "node_id": "<hex>" }
   *
   * FFI call:
   *   iroh::Endpoint::node_id() → PublicKey → to_string() → hex
   */
  nodeId(): string {
    throw new IrohTransportNotConnectedError(
      'nodeId()',
      'GET {rpcUrl}/node/id → { node_id: string }',
      'Start iroh with `iroh start`, then fetch /node/id. ' +
        'The node_id is a base32-encoded NodeId; convert to hex for DOT compatibility.',
    );
  }

  // -------------------------------------------------------------------------
  // Room operations
  // -------------------------------------------------------------------------

  /**
   * Creates a new iroh-doc namespace (room).
   *
   * iroh API call:
   *   POST {rpcUrl}/docs/create
   *   Response: { "id": "<namespace_id_hex>" }
   *
   * FFI call:
   *   let doc = node.docs().create().await?;
   *   let id = doc.id(); // NamespaceId
   *
   * iroh-doc details:
   *   - NamespaceId is an Ed25519 public key (32 bytes, hex-encoded here)
   *   - The secret key (NamespaceSecret) controls write access to the namespace
   *   - Store the NamespaceSecret securely — it's needed to invite peers
   */
  async createRoom(name: string): Promise<RoomHandle> {
    throw new IrohTransportNotConnectedError(
      `createRoom(${JSON.stringify(name)})`,
      'POST {rpcUrl}/docs/create → { id: string }',
      'Creates a new iroh-doc. Store the returned NamespaceId as room.id. ' +
        'Announce the room name → NamespaceId mapping via iroh-gossip so peers can discover it.',
    );
  }

  /**
   * Joins an existing iroh-doc namespace via a DocTicket.
   *
   * iroh API call:
   *   POST {rpcUrl}/docs/join
   *   Body: { "ticket": "<doc_ticket_string>" }
   *   Response: { "id": "<namespace_id_hex>" }
   *
   * FFI call:
   *   let ticket = DocTicket::from_str(ticket_str)?;
   *   let doc = node.docs().import(ticket).await?;
   *
   * iroh DocTicket format:
   *   A base32-encoded blob containing:
   *     - NamespaceId (which namespace to join)
   *     - CapabilityKind (read-only or read-write)
   *     - List of relay URLs and direct addresses for bootstrap peers
   *
   * Without a ticket, use iroh-gossip DHT to discover the namespace
   * from the room name → NamespaceId announcement.
   */
  async joinRoom(name: string, ticket?: string): Promise<RoomHandle> {
    throw new IrohTransportNotConnectedError(
      `joinRoom(${JSON.stringify(name)}, ${ticket !== undefined ? 'ticket' : 'undefined'})`,
      'POST {rpcUrl}/docs/join { ticket } → { id: string }',
      'Pass the DocTicket string from the room creator. ' +
        'If no ticket: query iroh-gossip DHT for the room name → NamespaceId mapping, ' +
        'then join by NamespaceId directly.',
    );
  }

  /**
   * Lists all open iroh-doc namespaces on this node.
   *
   * iroh API call:
   *   GET {rpcUrl}/docs
   *   Response: { "docs": [{ "id": "<namespace_id>" }, ...] }
   *
   * FFI call:
   *   let docs = node.docs().list().await?;
   */
  async listRooms(): Promise<string[]> {
    throw new IrohTransportNotConnectedError(
      'listRooms()',
      'GET {rpcUrl}/docs → { docs: Array<{ id: string }> }',
      'Returns all open iroh-docs. Map each doc.id (NamespaceId) to the ' +
        'human-readable name by querying the gossip name-registry.',
    );
  }

  // -------------------------------------------------------------------------
  // DOT operations
  // -------------------------------------------------------------------------

  /**
   * Publishes a DOT as an iroh-doc entry.
   *
   * iroh API call:
   *   POST {rpcUrl}/docs/{namespace_id}/set
   *   Body: {
   *     "author_id": "<author_id>",
   *     "key": "<dot_hash_hex>",          // BLAKE3 hash of DOT (32 bytes → 64 hex chars)
   *     "value": "<dot_bytes_base64>",    // toBytes(dot) encoded as base64
   *   }
   *
   * FFI call:
   *   let hash = blake3_hash(&dot_bytes);
   *   let key = hash.as_bytes().to_vec();
   *   doc.set_bytes(author, key, dot_bytes).await?;
   *
   * Key design:
   *   Using the BLAKE3 DOT hash as the entry key achieves content-addressing
   *   in iroh-docs. This matches iroh's native BLAKE3 content addressing and
   *   deduplicates entries automatically (same DOT → same key → idempotent set).
   *
   * Author:
   *   The iroh AuthorId should be derived from the DOT observer's Ed25519 key
   *   to preserve the DOT's signing identity through the iroh layer.
   */
  async publishDot(room: RoomHandle, dot: DOT): Promise<void> {
    throw new IrohTransportNotConnectedError(
      `publishDot(room=${room.id.slice(0, 8)}..., dot)`,
      'POST {rpcUrl}/docs/{namespace_id}/set { author_id, key: dot_hash, value: dot_bytes_b64 }',
      'Encode dot with toBytes(dot) from @dot-protocol/core. ' +
        'Use the BLAKE3 DOT hash as the iroh-doc entry key (natural content addressing). ' +
        'Use an AuthorId derived from the DOT observer\'s Ed25519 key.',
    );
  }

  /**
   * Subscribes to live DOT events from an iroh-doc namespace.
   *
   * iroh API call (Server-Sent Events):
   *   GET {rpcUrl}/docs/{namespace_id}/subscribe
   *   Response: SSE stream of events:
   *     { "type": "insert_remote", "entry": { "key": "...", "author": "..." } }
   *     { "type": "insert_local",  "entry": { ... } }
   *
   * FFI call:
   *   let stream = doc.subscribe().await?;
   *   while let Some(event) = stream.next().await {
   *     match event { InsertRemote { entry, .. } => { fetch entry bytes → decode DOT } }
   *   }
   *
   * On each InsertRemote (or InsertLocal) event:
   *   1. Fetch entry bytes: GET {rpcUrl}/docs/{id}/get/exact?key={entry_key}&author={author_id}
   *   2. Decode: fromBytes(bytes) from @dot-protocol/core
   *   3. Verify signature if DOT has sign base
   *   4. Call handler(dot)
   */
  subscribeDots(room: RoomHandle, _handler: (dot: DOT) => void): Unsubscribe {
    throw new IrohTransportNotConnectedError(
      `subscribeDots(room=${room.id.slice(0, 8)}...)`,
      'GET {rpcUrl}/docs/{namespace_id}/subscribe (SSE stream)',
      'Open an SSE connection to the iroh-doc subscribe endpoint. ' +
        'On each InsertRemote event, fetch the entry bytes and decode with fromBytes(). ' +
        'Return a function that closes the SSE connection (unsubscribe).',
    );
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /**
   * Triggers sync for an iroh-doc namespace with known peers.
   *
   * iroh API call:
   *   POST {rpcUrl}/docs/{namespace_id}/share
   *   Body: { "mode": "write" | "read", "addr_options": "id_and_addrs" }
   *   Then: POST {rpcUrl}/docs/{namespace_id}/sync-peers
   *   Body: { "peers": [{ "node_id": "...", "addrs": [...] }] }
   *
   * FFI call:
   *   doc.start_sync(peers).await?;
   *   doc.sync_finished().await?; // wait for completion
   *
   * Sync protocol:
   *   iroh-docs uses a range-based set reconciliation protocol (RBSR).
   *   Peers exchange fingerprints of their entry ranges, then transfer
   *   only the missing entries. More efficient than full enumeration.
   */
  async sync(room: RoomHandle): Promise<SyncStatus> {
    throw new IrohTransportNotConnectedError(
      `sync(room=${room.id.slice(0, 8)}...)`,
      'POST {rpcUrl}/docs/{namespace_id}/sync-peers { peers }',
      'Call doc.start_sync() with connected peers. ' +
        'Wait for doc.sync_finished() signal. ' +
        'Then query entry counts to build SyncStatus.',
    );
  }

  /**
   * Returns current sync status without triggering a sync.
   *
   * iroh API call:
   *   GET {rpcUrl}/docs/{namespace_id}/info
   *   Response: { "id": "...", "capability": "...", "entries": <count> }
   *
   * FFI call:
   *   doc.get_many(Query::all()).await? → count entries
   */
  getSyncStatus(room: RoomHandle): SyncStatus {
    throw new IrohTransportNotConnectedError(
      `getSyncStatus(room=${room.id.slice(0, 8)}...)`,
      'GET {rpcUrl}/docs/{namespace_id}/info → { entries: number }',
      'Query local and remote entry counts to compute sync delta. ' +
        'pendingSync = remoteDots - localDots (conservative estimate).',
    );
  }

  // -------------------------------------------------------------------------
  // Peer management
  // -------------------------------------------------------------------------

  /**
   * Connects to a remote peer by NodeId.
   *
   * iroh API call:
   *   POST {rpcUrl}/node/connect
   *   Body: { "node_id": "<node_id>", "addrs": ["addr1", "addr2"] }
   *
   * FFI call:
   *   let endpoint = node.endpoint();
   *   endpoint.connect(node_addr, ALPN).await?;
   *
   * NAT traversal:
   *   iroh automatically attempts:
   *     1. Direct UDP hole punching
   *     2. QUIC relay fallback (via iroh relay servers)
   *   No manual NAT configuration needed.
   *
   * NodeId format:
   *   iroh uses base32-encoded NodeIds in its API.
   *   DOT uses hex-encoded public keys.
   *   Conversion: hex → 32 bytes → base32 (for iroh API calls).
   */
  async connectPeer(nodeId: string): Promise<void> {
    throw new IrohTransportNotConnectedError(
      `connectPeer(${nodeId.slice(0, 8)}...)`,
      'POST {rpcUrl}/node/connect { node_id: base32_node_id, addrs: [] }',
      'Convert hex nodeId to base32 NodeId for iroh API. ' +
        'iroh handles NAT traversal automatically — just provide the NodeId, ' +
        'optionally with known relay URLs for faster connection.',
    );
  }

  /**
   * Disconnects from a peer.
   *
   * iroh API call:
   *   (No direct HTTP endpoint for disconnect — close the iroh-doc sync for this peer,
   *    or let the connection idle-close per QUIC keepalive settings)
   *
   * FFI call:
   *   endpoint.close(0u32, b"bye").await?; // close QUIC connection
   */
  disconnectPeer(nodeId: string): void {
    throw new IrohTransportNotConnectedError(
      `disconnectPeer(${nodeId.slice(0, 8)}...)`,
      'QUIC connection close (no direct HTTP endpoint)',
      'Use iroh FFI: endpoint.close() for the specific NodeId. ' +
        'Via HTTP: remove peer from doc sync list and let QUIC idle-timeout handle cleanup.',
    );
  }

  /**
   * Returns currently connected peer IDs.
   *
   * iroh API call:
   *   GET {rpcUrl}/node/connections
   *   Response: { "connections": [{ "node_id": "...", "addrs": [...] }] }
   *
   * FFI call:
   *   node.endpoint().remote_info_iter() → filter connected
   */
  connectedPeers(): string[] {
    throw new IrohTransportNotConnectedError(
      'connectedPeers()',
      'GET {rpcUrl}/node/connections → { connections: Array<{ node_id: string }> }',
      'Returns all active QUIC connections. ' +
        'Convert iroh base32 NodeIds to hex for DOT compatibility.',
    );
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Gracefully shuts down the iroh node.
   *
   * iroh API call:
   *   POST {rpcUrl}/node/shutdown
   *   Body: { "force": false }
   *
   * FFI call:
   *   node.shutdown().await?;
   *
   * Graceful shutdown:
   *   iroh will complete in-flight sync operations before shutting down.
   *   Set force=true to terminate immediately (data loss risk).
   */
  async shutdown(): Promise<void> {
    throw new IrohTransportNotConnectedError(
      'shutdown()',
      'POST {rpcUrl}/node/shutdown { force: false }',
      'Sends shutdown signal to the iroh node process. ' +
        'Use force=false for graceful shutdown (waits for active operations). ' +
        'Use force=true only in tests or emergency teardown.',
    );
  }
}
