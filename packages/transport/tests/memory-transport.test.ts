/**
 * memory-transport.test.ts — Tests for MemoryDotTransport.
 *
 * Covers:
 *   - Room creation and joining
 *   - DOT publishing and subscription (fan-out)
 *   - Multi-node DOT exchange via shared hub
 *   - Peer management
 *   - Sync operations
 *   - Shutdown behavior
 *   - High-volume (100 DOTs) publishing
 *   - Room isolation (DOTs don't leak across rooms)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import {
  MemoryDotTransport,
  MemoryTransportHub,
} from '../src/memory-transport.js';
import type { RoomHandle, SyncStatus } from '../src/interface.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransport(hub: MemoryTransportHub, nodeId?: string): MemoryDotTransport {
  return new MemoryDotTransport(hub, nodeId);
}

function simpleDot(content: string): DOT {
  return observe(content, { plaintext: true });
}

/** Collect dots received by a subscriber, returns cleanup. */
function collectDots(
  transport: MemoryDotTransport,
  handle: RoomHandle,
): { received: DOT[]; stop: () => void } {
  const received: DOT[] = [];
  const stop = transport.subscribeDots(handle, (dot) => received.push(dot));
  return { received, stop };
}

// ---------------------------------------------------------------------------
// Room creation
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — room creation', () => {
  it('createRoom returns a RoomHandle with the given name', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('alpha');
    expect(handle.name).toBe('alpha');
  });

  it('createRoom returns a RoomHandle with a non-empty id', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('beta');
    expect(handle.id.length).toBeGreaterThan(0);
  });

  it('createRoom sets memberCount to 1 (just the creator)', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('gamma');
    expect(handle.memberCount).toBe(1);
  });

  it('createRoom sets dotCount to 0 initially', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('delta');
    expect(handle.dotCount).toBe(0);
  });

  it('two rooms have different IDs', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const h1 = await t.createRoom('room-1');
    const h2 = await t.createRoom('room-2');
    expect(h1.id).not.toBe(h2.id);
  });
});

// ---------------------------------------------------------------------------
// Room joining
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — room joining', () => {
  it('joinRoom returns a handle for a room created by another node', async () => {
    const hub = new MemoryTransportHub();
    const creator = makeTransport(hub, 'node-creator');
    const joiner = makeTransport(hub, 'node-joiner');

    await creator.createRoom('shared');
    const handle = await joiner.joinRoom('shared');
    expect(handle.name).toBe('shared');
  });

  it('joinRoom increments memberCount', async () => {
    const hub = new MemoryTransportHub();
    const t1 = makeTransport(hub, 'node-A');
    const t2 = makeTransport(hub, 'node-B');

    await t1.createRoom('counting-room');
    const handle = await t2.joinRoom('counting-room');
    // Both t1 and t2 are now members
    expect(handle.memberCount).toBe(2);
  });

  it('joinRoom with ticket (ignored in memory mode) still succeeds', async () => {
    const hub = new MemoryTransportHub();
    const t1 = makeTransport(hub, 'node-X');
    const t2 = makeTransport(hub, 'node-Y');

    await t1.createRoom('ticket-room');
    const handle = await t2.joinRoom('ticket-room', 'fake-iroh-ticket-abc123');
    expect(handle.name).toBe('ticket-room');
  });

  it('joinRoom gives access to existing DOTs (catch-up sync)', async () => {
    const hub = new MemoryTransportHub();
    const publisher = makeTransport(hub, 'publisher');
    const lateJoiner = makeTransport(hub, 'late-joiner');

    const h = await publisher.createRoom('history-room');
    await publisher.publishDot(h, simpleDot('dot-1'));
    await publisher.publishDot(h, simpleDot('dot-2'));

    const joinHandle = await lateJoiner.joinRoom('history-room');
    // After joining, localDots should reflect existing room DOTs
    const status = lateJoiner.getSyncStatus(joinHandle);
    expect(status.localDots).toBe(2);
  });

  it('joinRoom on non-existent room creates it', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.joinRoom('new-room-via-join');
    expect(handle.name).toBe('new-room-via-join');
  });
});

// ---------------------------------------------------------------------------
// listRooms
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — listRooms', () => {
  it('returns empty array when no rooms created', async () => {
    // Use a fresh hub with no rooms
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const rooms = await t.listRooms();
    expect(rooms).toEqual([]);
  });

  it('returns all created rooms', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await t.createRoom('room-a');
    await t.createRoom('room-b');
    await t.createRoom('room-c');
    const rooms = await t.listRooms();
    expect(rooms).toContain('room-a');
    expect(rooms).toContain('room-b');
    expect(rooms).toContain('room-c');
  });
});

// ---------------------------------------------------------------------------
// publishDot
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — publishDot', () => {
  it('publishDot stores a DOT in the room', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('publish-test');
    await t.publishDot(handle, simpleDot('hello'));
    expect(hub.dotCount('publish-test')).toBe(1);
  });

  it('publishDot increments dotCount', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('count-test');
    await t.publishDot(handle, simpleDot('a'));
    await t.publishDot(handle, simpleDot('b'));
    await t.publishDot(handle, simpleDot('c'));
    expect(hub.dotCount('count-test')).toBe(3);
  });

  it('publishDot updates sync status', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('sync-status-test');
    await t.publishDot(handle, simpleDot('test'));
    const status = t.getSyncStatus(handle);
    expect(status.synced).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// subscribeDots — fan-out behavior
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — subscribeDots', () => {
  it('subscriber receives DOT published by another node', async () => {
    const hub = new MemoryTransportHub();
    const publisher = makeTransport(hub, 'pub');
    const subscriber = makeTransport(hub, 'sub');

    const pubHandle = await publisher.createRoom('fan-out');
    const subHandle = await subscriber.joinRoom('fan-out');

    const { received, stop } = collectDots(subscriber, subHandle);
    await publisher.publishDot(pubHandle, simpleDot('cross-node'));
    stop();

    expect(received.length).toBe(1);
  });

  it('publisher does NOT receive its own DOT (no echo)', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub, 'self');

    const handle = await t.createRoom('no-echo');
    const { received, stop } = collectDots(t, handle);
    await t.publishDot(handle, simpleDot('self-publish'));
    stop();

    expect(received.length).toBe(0);
  });

  it('multiple subscribers all receive the same DOT', async () => {
    const hub = new MemoryTransportHub();
    const pub = makeTransport(hub, 'publisher');
    const sub1 = makeTransport(hub, 'sub-1');
    const sub2 = makeTransport(hub, 'sub-2');
    const sub3 = makeTransport(hub, 'sub-3');

    const pubH = await pub.createRoom('broadcast-room');
    const sub1H = await sub1.joinRoom('broadcast-room');
    const sub2H = await sub2.joinRoom('broadcast-room');
    const sub3H = await sub3.joinRoom('broadcast-room');

    const r1 = collectDots(sub1, sub1H);
    const r2 = collectDots(sub2, sub2H);
    const r3 = collectDots(sub3, sub3H);

    await pub.publishDot(pubH, simpleDot('broadcast-msg'));

    r1.stop();
    r2.stop();
    r3.stop();

    expect(r1.received.length).toBe(1);
    expect(r2.received.length).toBe(1);
    expect(r3.received.length).toBe(1);
  });

  it('unsubscribe stops receiving DOTs', async () => {
    const hub = new MemoryTransportHub();
    const pub = makeTransport(hub, 'pub-unsub');
    const sub = makeTransport(hub, 'sub-unsub');

    const pubH = await pub.createRoom('unsub-room');
    const subH = await sub.joinRoom('unsub-room');

    const { received, stop } = collectDots(sub, subH);
    await pub.publishDot(pubH, simpleDot('before-unsub'));
    stop();  // Unsubscribe
    await pub.publishDot(pubH, simpleDot('after-unsub'));

    expect(received.length).toBe(1);
    expect(received[0]!.payload).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — sync', () => {
  it('sync returns a SyncStatus', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('sync-room');
    const status = await t.sync(handle);
    expect(status).toMatchObject({
      synced: expect.any(Boolean),
      localDots: expect.any(Number),
      remoteDots: expect.any(Number),
      pendingSync: expect.any(Number),
      lastSyncMs: expect.any(Number),
    });
  });

  it('sync after publishing returns synced=true', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('sync-after-pub');
    await t.publishDot(handle, simpleDot('x'));
    const status = await t.sync(handle);
    expect(status.synced).toBe(true);
  });

  it('getSyncStatus returns zero counts before first interaction', () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const fakeHandle: RoomHandle = { name: 'unknown', id: 'id', memberCount: 0, dotCount: 0 };
    const status = t.getSyncStatus(fakeHandle);
    expect(status.localDots).toBe(0);
    expect(status.remoteDots).toBe(0);
    expect(status.synced).toBe(false);
  });

  it('getSyncStatus lastSyncMs is 0 before any sync', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('pre-sync');
    const status = t.getSyncStatus(handle);
    expect(status.lastSyncMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Peer management
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — peer management', () => {
  it('connectedPeers returns empty array initially', () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    expect(t.connectedPeers()).toEqual([]);
  });

  it('connectPeer adds peer to list', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await t.connectPeer('peer-abc');
    expect(t.connectedPeers()).toContain('peer-abc');
  });

  it('disconnectPeer removes peer from list', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await t.connectPeer('peer-xyz');
    t.disconnectPeer('peer-xyz');
    expect(t.connectedPeers()).not.toContain('peer-xyz');
  });

  it('multiple peers can be connected simultaneously', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await t.connectPeer('peer-1');
    await t.connectPeer('peer-2');
    await t.connectPeer('peer-3');
    expect(t.connectedPeers().length).toBe(3);
  });

  it('disconnecting unknown peer is a no-op', () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    expect(() => t.disconnectPeer('nonexistent')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// nodeId
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — nodeId', () => {
  it('nodeId returns a non-empty string', () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    expect(t.nodeId().length).toBeGreaterThan(0);
  });

  it('custom nodeId is returned exactly', () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub, 'my-custom-node-id');
    expect(t.nodeId()).toBe('my-custom-node-id');
  });

  it('two nodes without custom IDs have different IDs', () => {
    const hub = new MemoryTransportHub();
    const t1 = makeTransport(hub);
    const t2 = makeTransport(hub);
    expect(t1.nodeId()).not.toBe(t2.nodeId());
  });
});

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — shutdown', () => {
  it('shutdown() resolves without error', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await expect(t.shutdown()).resolves.toBeUndefined();
  });

  it('operations after shutdown throw', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await t.shutdown();
    await expect(t.createRoom('post-shutdown')).rejects.toThrow('shut down');
  });

  it('shutdown clears connected peers', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    await t.connectPeer('peer-a');
    await t.shutdown();
    // After shutdown, peers are cleared
    expect(t.connectedPeers()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// High volume — 100 DOTs
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — high volume', () => {
  it('100 DOTs published are all received by subscriber', async () => {
    const hub = new MemoryTransportHub();
    const pub = makeTransport(hub, 'high-vol-pub');
    const sub = makeTransport(hub, 'high-vol-sub');

    const pubH = await pub.createRoom('high-vol');
    const subH = await sub.joinRoom('high-vol');

    const { received, stop } = collectDots(sub, subH);

    for (let i = 0; i < 100; i++) {
      await pub.publishDot(pubH, simpleDot(`dot-${i}`));
    }

    stop();
    expect(received.length).toBe(100);
  });

  it('100 DOTs published → dotCount is 100', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const handle = await t.createRoom('bulk');
    for (let i = 0; i < 100; i++) {
      await t.publishDot(handle, simpleDot(`item-${i}`));
    }
    expect(hub.dotCount('bulk')).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Room isolation
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — room isolation', () => {
  it('DOTs published to room-A do not appear in room-B', async () => {
    const hub = new MemoryTransportHub();
    const pub = makeTransport(hub, 'iso-pub');
    const subA = makeTransport(hub, 'iso-sub-a');
    const subB = makeTransport(hub, 'iso-sub-b');

    const hA = await pub.createRoom('iso-room-A');
    const hB = await pub.createRoom('iso-room-B');
    const subAH = await subA.joinRoom('iso-room-A');
    const subBH = await subB.joinRoom('iso-room-B');

    const rA = collectDots(subA, subAH);
    const rB = collectDots(subB, subBH);

    // Publish only to room A
    await pub.publishDot(hA, simpleDot('only-for-A'));

    rA.stop();
    rB.stop();

    expect(rA.received.length).toBe(1);
    expect(rB.received.length).toBe(0);
  });

  it('two rooms have independent DOT counts', async () => {
    const hub = new MemoryTransportHub();
    const t = makeTransport(hub);
    const h1 = await t.createRoom('isolated-1');
    const h2 = await t.createRoom('isolated-2');

    await t.publishDot(h1, simpleDot('a'));
    await t.publishDot(h1, simpleDot('b'));
    await t.publishDot(h2, simpleDot('c'));

    expect(hub.dotCount('isolated-1')).toBe(2);
    expect(hub.dotCount('isolated-2')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Two nodes sharing a hub
// ---------------------------------------------------------------------------

describe('MemoryDotTransport — two nodes sharing hub', () => {
  it('node A and node B can exchange DOTs bidirectionally', async () => {
    const hub = new MemoryTransportHub();
    const nodeA = makeTransport(hub, 'node-A');
    const nodeB = makeTransport(hub, 'node-B');

    const hA = await nodeA.createRoom('bidirectional');
    const hB = await nodeB.joinRoom('bidirectional');

    const receivedByA: DOT[] = [];
    const receivedByB: DOT[] = [];
    const stopA = nodeA.subscribeDots(hA, (d) => receivedByA.push(d));
    const stopB = nodeB.subscribeDots(hB, (d) => receivedByB.push(d));

    await nodeA.publishDot(hA, simpleDot('from-A'));
    await nodeB.publishDot(hB, simpleDot('from-B'));

    stopA();
    stopB();

    expect(receivedByA.length).toBe(1); // A receives B's DOT
    expect(receivedByB.length).toBe(1); // B receives A's DOT
  });
});
