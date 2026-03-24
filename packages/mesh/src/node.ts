/**
 * node.ts — MeshNode: the core peer-to-peer DOT routing unit.
 *
 * A MeshNode:
 *   - Connects to peers via a pluggable Transport
 *   - Broadcasts DOTs to all connected peers
 *   - Responds to hash-based DOT requests
 *   - Maintains a local content-addressed store (MemoryStorage by default)
 *   - Deduplicates incoming DOTs via a seen-hash Set
 */

import { toBytes, fromBytes, observe } from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { MemoryStorage, dotHashToHex } from '@dot-protocol/chain';
import type { StorageBackend } from '@dot-protocol/chain';
import type { Transport } from './transport/interface.js';
import {
  encodeMeshMessage,
  decodeMeshMessage,
  type MeshMessage,
} from './protocol.js';

/** Configuration for creating a MeshNode. */
export interface MeshNodeConfig {
  /** The node's Ed25519 identity (publicKey used as node ID). */
  identity: Identity;
  /** Transport implementation for sending/receiving raw bytes. */
  transport: Transport;
  /** Optional storage backend (defaults to MemoryStorage). */
  storage?: StorageBackend;
}

/** Entry in the peer table. */
export interface PeerEntry {
  /** Ed25519 public key of the peer (may be unknown for unauthenticated peers). */
  publicKey?: Uint8Array;
  /** Unix ms of last seen message from this peer. */
  lastSeen: number;
  /** Trust score 0–1. Starts at 0.5, adjusts over time. */
  trustScore: number;
}

/** Handle returned by createNode. */
export interface MeshNode {
  /** This node's identifier (hex-encoded public key). */
  readonly id: string;
  /** Read-only map of connected peer IDs to their table entries. */
  readonly peers: Map<string, PeerEntry>;
  /** Storage backend for locally stored DOTs. */
  readonly storage: StorageBackend;
  /** Broadcast a DOT to all connected peers. Returns count of peers reached. */
  broadcast(dot: DOT): Promise<number>;
  /** Request a DOT by hash from peers. Returns the DOT or null if not found. */
  request(hash: string): Promise<DOT | null>;
  /** Register a handler called whenever a new (non-duplicate) DOT arrives. */
  onDot(handler: (dot: DOT, from: string) => void): void;
  /** Store a DOT locally (content-addressed by its BLAKE3 hash). */
  store(dot: DOT): string;
  /** Return a health-measure DOT describing this node's current state. */
  health(): DOT;
  /** Disconnect all peers and unregister from the transport. */
  close(): void;
}

/**
 * Create a new MeshNode.
 *
 * @param config - Node configuration: identity, transport, optional storage.
 * @returns A live MeshNode ready to connect peers and exchange DOTs.
 */
export function createNode(config: MeshNodeConfig): MeshNode {
  const { identity, transport, storage = new MemoryStorage() } = config;

  // Node ID = hex-encoded public key
  const id = Buffer.from(identity.publicKey).toString('hex');

  // Peer table
  const peers = new Map<string, PeerEntry>();

  // Deduplication: seen DOT hashes
  const seenHashes = new Set<string>();

  // Stats
  let dotsBroadcast = 0;
  let requestSuccesses = 0;
  let requestAttempts = 0;
  let healthSeq = 0;

  // Registered dot handlers
  const dotHandlers: Array<(dot: DOT, from: string) => void> = [];

  // Pending request resolvers: hash -> resolve fn
  const pendingRequests = new Map<string, (dot: DOT | null) => void>();

  /** Dispatch an incoming raw message from the transport. */
  function handleRawMessage(peerId: string, data: Uint8Array): void {
    let msg: MeshMessage;
    try {
      msg = decodeMeshMessage(data);
    } catch {
      // Malformed message — ignore
      return;
    }

    // Update peer table
    const existing = peers.get(peerId);
    if (existing !== undefined) {
      existing.lastSeen = Date.now();
    } else {
      peers.set(peerId, { lastSeen: Date.now(), trustScore: 0.5 });
    }

    switch (msg.type) {
      case 'dot':
        handleIncomingDot(msg.payload, peerId);
        break;
      case 'request':
        handleRequest(msg.payload, peerId);
        break;
      case 'response':
        handleResponse(msg.payload, msg.from);
        break;
      case 'gossip':
        handleGossip(msg.payload, peerId);
        break;
      case 'ping':
        handlePing(peerId);
        break;
      case 'pong':
        // Update lastSeen already done above
        break;
    }
  }

  /** Handle an incoming DOT payload from a peer. */
  function handleIncomingDot(payload: Uint8Array, from: string): void {
    let dot: DOT;
    try {
      dot = fromBytes(payload);
    } catch {
      return;
    }

    const hash = dotHashToHex(dot);

    if (seenHashes.has(hash)) {
      return; // deduplicate
    }
    seenHashes.add(hash);

    // Store locally
    storage.put(dot, hash);

    // Dispatch to handlers
    for (const handler of dotHandlers) {
      handler(dot, from);
    }
  }

  /** Handle a request for a DOT by hash. */
  function handleRequest(payload: Uint8Array, from: string): void {
    const hash = new TextDecoder().decode(payload);
    const dot = storage.get(hash);

    let responsePayload: Uint8Array;
    if (dot !== null) {
      responsePayload = toBytes(dot);
    } else {
      responsePayload = new Uint8Array(0);
    }

    const msg: MeshMessage = {
      type: 'response',
      payload: responsePayload,
      from: id,
    };

    void transport.send(from, encodeMeshMessage(msg));
  }

  /** Handle a response to a DOT request. */
  function handleResponse(payload: Uint8Array, _from: string): void {
    if (payload.length === 0) {
      // Not found — we don't know which hash this is for without tracking request ids.
      // Responses are matched by the requesting side via hash of the content.
      return;
    }

    let dot: DOT;
    try {
      dot = fromBytes(payload);
    } catch {
      return;
    }

    const hash = dotHashToHex(dot);
    const resolve = pendingRequests.get(hash);
    if (resolve !== undefined) {
      pendingRequests.delete(hash);
      requestSuccesses++;
      resolve(dot);
    }

    // Also store the received DOT locally
    if (!seenHashes.has(hash)) {
      seenHashes.add(hash);
      storage.put(dot, hash);
    }
  }

  /** Handle a gossip message: a list of hashes we may not have. */
  function handleGossip(payload: Uint8Array, from: string): void {
    // Gossip payload: list of 64-char hex hashes separated by newlines
    const hashes = new TextDecoder().decode(payload).split('\n').filter((h) => h.length === 64);

    for (const hash of hashes) {
      if (!seenHashes.has(hash) && !storage.has(hash)) {
        // Request this DOT from the gossip sender
        const requestMsg: MeshMessage = {
          type: 'request',
          payload: new TextEncoder().encode(hash),
          from: id,
        };
        void transport.send(from, encodeMeshMessage(requestMsg));
      }
    }
  }

  /** Respond to a ping with a pong. */
  function handlePing(from: string): void {
    const pong: MeshMessage = {
      type: 'pong',
      payload: new Uint8Array(0),
      from: id,
    };
    void transport.send(from, encodeMeshMessage(pong));
  }

  // Wire up the transport message handler
  transport.onMessage(handleRawMessage);

  // --- Public interface ---

  function broadcast(dot: DOT): Promise<number> {
    const peerList = transport.peers();
    if (peerList.length === 0) return Promise.resolve(0);

    const hash = dotHashToHex(dot);
    seenHashes.add(hash); // Don't rebroadcast our own DOTs
    storage.put(dot, hash);

    const msg: MeshMessage = {
      type: 'dot',
      payload: toBytes(dot),
      from: id,
    };
    const encoded = encodeMeshMessage(msg);
    dotsBroadcast++;

    const sends = peerList.map((peerId) =>
      transport.send(peerId, encoded).then(() => 1 as const).catch(() => 0 as const),
    );

    return Promise.all(sends).then((results) => results.reduce((a, b) => a + b, 0));
  }

  function request(hash: string): Promise<DOT | null> {
    // Check local storage first
    const local = storage.get(hash);
    if (local !== null) {
      requestSuccesses++;
      return Promise.resolve(local);
    }

    const peerList = transport.peers();
    if (peerList.length === 0) return Promise.resolve(null);

    requestAttempts++;

    return new Promise<DOT | null>((resolve) => {
      // Set up resolver for response handler
      pendingRequests.set(hash, resolve);

      // Ask all peers
      const requestMsg: MeshMessage = {
        type: 'request',
        payload: new TextEncoder().encode(hash),
        from: id,
      };
      const encoded = encodeMeshMessage(requestMsg);

      for (const peerId of peerList) {
        void transport.send(peerId, encoded);
      }

      // Timeout after 500ms (configurable via environment for tests)
      setTimeout(() => {
        if (pendingRequests.has(hash)) {
          pendingRequests.delete(hash);
          resolve(null);
        }
      }, 500);
    });
  }

  function onDot(handler: (dot: DOT, from: string) => void): void {
    dotHandlers.push(handler);
  }

  function store(dot: DOT): string {
    const hash = dotHashToHex(dot);
    seenHashes.add(hash);
    storage.put(dot, hash);
    return hash;
  }

  function health(): DOT {
    const peerList = transport.peers();
    const successRate = requestAttempts === 0 ? 1 : requestSuccesses / requestAttempts;

    const report = {
      node_id: id,
      peer_count: peerList.length,
      dots_stored: storage.count(),
      dots_broadcast: dotsBroadcast,
      request_success_rate: Math.round(successRate * 100) / 100,
      seen_hashes: seenHashes.size,
      observed_at: new Date().toISOString(),
      seq: ++healthSeq,
    };

    return observe(JSON.stringify(report), { type: 'measure', plaintext: true });
  }

  function close(): void {
    for (const peerId of transport.peers()) {
      transport.disconnect(peerId);
    }
    peers.clear();
    seenHashes.clear();
    pendingRequests.clear();
  }

  return { id, peers, storage, broadcast, request, onDot, store, health, close };
}
