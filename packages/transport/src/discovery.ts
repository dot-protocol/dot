/**
 * discovery.ts — Room discovery for the DOT transport layer.
 *
 * RoomDiscovery maintains a local registry of known rooms and provides
 * query, announce, and list operations.
 *
 * iroh integration:
 *   In production with IrohDotTransport, discovery uses:
 *     1. iroh-gossip: rooms announce their NamespaceId → name mapping
 *        via a well-known gossip topic (e.g., "dot-protocol-rooms-v1")
 *     2. iroh DHT (Mainline DHT / PKARR): nodes publish their room list
 *        under their NodeId for asynchronous discovery
 *   For now (MemoryDotTransport): in-memory registry.
 *
 * Usage:
 *   const discovery = new RoomDiscovery(transport);
 *   discovery.announce('team-alpha', handle);
 *   const results = discovery.discover('team');  // fuzzy prefix match
 *   const all = discovery.listKnown();
 */

import type { DotTransport, RoomHandle } from './interface.js';

/** A discovered room entry. */
export interface DiscoveredRoom {
  /** Human-readable room name. */
  name: string;
  /** Room handle (may have stale memberCount/dotCount — refresh via transport.joinRoom). */
  handle: RoomHandle;
  /** Unix ms when this room was announced/discovered. */
  discoveredAt: number;
  /**
   * The node ID that announced this room.
   * Useful for trusting discovery data — prefer rooms announced by known peers.
   */
  announcedBy: string;
}

/**
 * Room discovery registry.
 *
 * Maintains a local in-memory registry of announced rooms.
 * In production (with iroh), the registry is populated from
 * iroh-gossip announcements and DHT lookups.
 */
export class RoomDiscovery {
  private readonly transport: DotTransport;
  /** Map of roomName → discovered room entry. */
  private readonly registry = new Map<string, DiscoveredRoom>();

  constructor(transport: DotTransport) {
    this.transport = transport;
  }

  // -------------------------------------------------------------------------
  // Announce
  // -------------------------------------------------------------------------

  /**
   * Announce a room to the local registry (and gossip network in production).
   *
   * iroh integration:
   *   Publish a gossip message on the "dot-protocol-rooms-v1" topic:
   *   { name, namespace_id: handle.id, announced_by: nodeId }
   *
   * @param roomName - Human-readable room name.
   * @param handle   - The RoomHandle to announce.
   */
  announce(roomName: string, handle: RoomHandle): void {
    const entry: DiscoveredRoom = {
      name: roomName,
      handle,
      discoveredAt: Date.now(),
      announcedBy: this.transport.nodeId(),
    };
    this.registry.set(roomName, entry);
  }

  // -------------------------------------------------------------------------
  // Discover
  // -------------------------------------------------------------------------

  /**
   * Discover rooms matching a query string.
   *
   * Performs a case-insensitive prefix/substring match against room names.
   *
   * iroh integration:
   *   Query the iroh-gossip "dot-protocol-rooms-v1" topic for recent
   *   announcements matching the query. Also query DHT for any offline nodes.
   *
   * @param query - Query string to match against room names.
   * @returns Array of matching RoomHandles.
   */
  discover(query: string): RoomHandle[] {
    const q = query.toLowerCase();
    const results: RoomHandle[] = [];
    for (const entry of this.registry.values()) {
      if (entry.name.toLowerCase().includes(q)) {
        results.push(entry.handle);
      }
    }
    return results;
  }

  /**
   * Look up a room by exact name.
   *
   * @param name - Exact room name to look up.
   * @returns The DiscoveredRoom entry, or undefined if not found.
   */
  lookup(name: string): DiscoveredRoom | undefined {
    return this.registry.get(name);
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  /**
   * List all known rooms in the local registry.
   *
   * @returns Array of { name, handle } entries.
   */
  listKnown(): Array<{ name: string; handle: RoomHandle }> {
    return Array.from(this.registry.values()).map((entry) => ({
      name: entry.name,
      handle: entry.handle,
    }));
  }

  /**
   * List all known rooms with full discovery metadata.
   *
   * @returns Array of DiscoveredRoom entries sorted by discoveredAt (newest first).
   */
  listAll(): DiscoveredRoom[] {
    return Array.from(this.registry.values()).sort(
      (a, b) => b.discoveredAt - a.discoveredAt,
    );
  }

  // -------------------------------------------------------------------------
  // Refresh
  // -------------------------------------------------------------------------

  /**
   * Refresh the registry from the transport's room list.
   *
   * Queries transport.listRooms() and adds any rooms not already in the registry.
   * Useful for bootstrapping the registry after joining a network.
   *
   * iroh integration:
   *   Call after connecting to a gossip topic to seed the registry with
   *   rooms announced by peers we haven't heard from yet.
   */
  async refresh(): Promise<void> {
    const rooms = await this.transport.listRooms();
    const nodeId = this.transport.nodeId();
    for (const name of rooms) {
      if (!this.registry.has(name)) {
        // Create a minimal handle — memberCount/dotCount unknown without joining
        const stub: RoomHandle = {
          name,
          id: '',  // unknown until we join
          memberCount: 0,
          dotCount: 0,
        };
        this.registry.set(name, {
          name,
          handle: stub,
          discoveredAt: Date.now(),
          announcedBy: nodeId,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  /**
   * Remove a room from the local registry.
   *
   * Does NOT leave the room on the transport — call transport.leaveRoom() for that.
   *
   * @param name - Room name to remove.
   */
  forget(name: string): void {
    this.registry.delete(name);
  }

  /**
   * Clear the entire local registry.
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Return the total number of known rooms.
   */
  size(): number {
    return this.registry.size;
  }
}
