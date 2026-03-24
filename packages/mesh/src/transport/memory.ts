/**
 * MemoryTransport — in-process transport for unit testing mesh behavior.
 *
 * All messages are routed through a shared MemoryHub. No network, no I/O.
 * Simulates real transport with configurable latency (default 0ms for fast tests).
 */

import type { Transport } from './interface.js';

/**
 * Central message router for in-process MemoryTransports.
 *
 * Nodes register themselves by ID. The hub routes messages from sender to receiver.
 * A single MemoryHub simulates a fully-connected local network.
 */
export class MemoryHub {
  private readonly nodes = new Map<string, MemoryTransport>();
  /** Configurable latency in ms applied to every message delivery. */
  readonly latencyMs: number;

  constructor(latencyMs = 0) {
    this.latencyMs = latencyMs;
  }

  /**
   * Register a transport under a given nodeId.
   * Subsequent messages addressed to nodeId will be delivered to this transport.
   */
  register(nodeId: string, transport: MemoryTransport): void {
    this.nodes.set(nodeId, transport);
  }

  /**
   * Unregister a node from the hub (e.g. on close/disconnect).
   */
  unregister(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  /**
   * Route a message from `from` to `to`.
   * Silently drops the message if `to` is not registered.
   */
  route(from: string, to: string, data: Uint8Array): void {
    const target = this.nodes.get(to);
    if (target === undefined) return;

    if (this.latencyMs === 0) {
      target._deliver(from, data);
    } else {
      setTimeout(() => target._deliver(from, data), this.latencyMs);
    }
  }

  /**
   * Check whether a nodeId is registered in this hub.
   */
  has(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Return all registered node IDs.
   */
  nodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }
}

/**
 * In-process Transport implementation backed by a MemoryHub.
 *
 * Used exclusively in tests. Create one per node, share a single MemoryHub.
 */
export class MemoryTransport implements Transport {
  private readonly hub: MemoryHub;
  readonly nodeId: string;
  private messageHandler: ((peerId: string, data: Uint8Array) => void) | null = null;
  private readonly connectedPeers = new Set<string>();

  constructor(hub: MemoryHub, nodeId: string) {
    this.hub = hub;
    this.nodeId = nodeId;
    hub.register(nodeId, this);
  }

  /**
   * Called by the hub to deliver an incoming message to this transport.
   * Dispatches to the registered message handler.
   */
  _deliver(from: string, data: Uint8Array): void {
    if (this.messageHandler !== null) {
      this.messageHandler(from, data);
    }
  }

  async send(peerId: string, data: Uint8Array): Promise<void> {
    this.hub.route(this.nodeId, peerId, data);
  }

  onMessage(handler: (peerId: string, data: Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  async connect(address: string): Promise<string> {
    // For MemoryTransport, address == peerId (the target nodeId)
    this.connectedPeers.add(address);
    return address;
  }

  disconnect(peerId: string): void {
    this.connectedPeers.delete(peerId);
  }

  peers(): string[] {
    return Array.from(this.connectedPeers);
  }

  /**
   * Unregister this transport from the hub (for cleanup in tests).
   */
  close(): void {
    this.hub.unregister(this.nodeId);
    this.connectedPeers.clear();
  }
}
