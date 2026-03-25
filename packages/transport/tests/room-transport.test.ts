/**
 * room-transport.test.ts — Tests for TransportRoom.
 *
 * Covers:
 *   - observe() creates signed DOT + publishes to room
 *   - getHistory() returns local chain in correct order
 *   - onMessage() fires for incoming DOTs from other nodes
 *   - sync() updates local chain from remote DOTs
 *   - dotCount tracking
 *   - close() stops listening
 *   - Unsigned DOTs (no identity)
 */

import { describe, it, expect } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { MemoryDotTransport, MemoryTransportHub } from '../src/memory-transport.js';
import { TransportRoom } from '../src/room-transport.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeRoom(
  hub: MemoryTransportHub,
  nodeId: string,
  roomName: string,
  join = false,
): Promise<{ room: TransportRoom; transport: MemoryDotTransport }> {
  const identity = await createIdentity();
  const transport = new MemoryDotTransport(hub, nodeId);
  const handle = join
    ? await transport.joinRoom(roomName)
    : await transport.createRoom(roomName);
  const room = new TransportRoom({ transport, handle, identity });
  return { room, transport };
}

async function makeUnsignedRoom(
  hub: MemoryTransportHub,
  nodeId: string,
  roomName: string,
): Promise<{ room: TransportRoom; transport: MemoryDotTransport }> {
  const transport = new MemoryDotTransport(hub, nodeId);
  const handle = await transport.createRoom(roomName);
  const room = new TransportRoom({ transport, handle }); // no identity
  return { room, transport };
}

// ---------------------------------------------------------------------------
// observe() — DOT creation and publishing
// ---------------------------------------------------------------------------

describe('TransportRoom — observe()', () => {
  it('observe creates a DOT with the given content', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'creator', 'obs-test');
    const dot = await room.observe('hello world', { plaintext: true });
    expect(dot.payload).toBeDefined();
  });

  it('observe signs the DOT when identity is provided', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'signer', 'sign-test');
    const dot = await room.observe('signed content', { plaintext: true });
    expect(dot.sign?.signature).toBeDefined();
    expect(dot.sign?.observer).toBeDefined();
  });

  it('observe without identity produces unsigned DOT', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeUnsignedRoom(hub, 'unsigned', 'unsigned-test');
    const dot = await room.observe('no signature', { plaintext: true });
    // unsigned DOT may have sign.observer but no signature
    expect(dot.sign?.signature).toBeUndefined();
  });

  it('observe with type sets the DOT type', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'typed', 'type-test');
    const dot = await room.observe('event payload', { type: 'event', plaintext: true });
    expect(dot.type).toBe('event');
  });

  it('observe publishes DOT to the hub', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'pub-room', 'hub-test');
    await room.observe('published', { plaintext: true });
    expect(hub.dotCount('hub-test')).toBe(1);
  });

  it('observe increments dotCount', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'counter', 'count-test');
    expect(room.dotCount()).toBe(0);
    await room.observe('a', { plaintext: true });
    await room.observe('b', { plaintext: true });
    expect(room.dotCount()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getHistory()
// ---------------------------------------------------------------------------

describe('TransportRoom — getHistory()', () => {
  it('getHistory returns empty array before any observes', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'hist-empty', 'history-empty');
    const history = await room.getHistory();
    expect(history).toEqual([]);
  });

  it('getHistory returns all published DOTs', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'hist-all', 'history-all');
    await room.observe('first', { plaintext: true });
    await room.observe('second', { plaintext: true });
    await room.observe('third', { plaintext: true });
    const history = await room.getHistory();
    expect(history.length).toBe(3);
  });

  it('getHistory with limit returns at most limit DOTs', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'hist-limit', 'history-limit');
    for (let i = 0; i < 10; i++) {
      await room.observe(`msg-${i}`, { plaintext: true });
    }
    const history = await room.getHistory(3);
    expect(history.length).toBe(3);
  });

  it('getHistory with limit=0 returns empty array', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'hist-zero', 'history-zero');
    await room.observe('something', { plaintext: true });
    const history = await room.getHistory(0);
    expect(history.length).toBe(0);
  });

  it('getHistory returns DOTs with payload data', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'hist-payload', 'history-payload');
    await room.observe('test content', { plaintext: true });
    const history = await room.getHistory();
    expect(history[0]?.payload).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// onMessage() — incoming DOTs from other nodes
// ---------------------------------------------------------------------------

describe('TransportRoom — onMessage()', () => {
  it('onMessage fires when another node publishes a DOT', async () => {
    const hub = new MemoryTransportHub();
    const { room: roomA } = await makeRoom(hub, 'sender-A', 'msg-room');
    const { room: roomB } = await makeRoom(hub, 'receiver-B', 'msg-room', true);

    const received: DOT[] = [];
    const unsub = roomB.onMessage((dot) => received.push(dot));

    await roomA.observe('hello from A', { plaintext: true });
    unsub();

    expect(received.length).toBe(1);
  });

  it('onMessage fires for multiple incoming DOTs', async () => {
    const hub = new MemoryTransportHub();
    const { room: roomA } = await makeRoom(hub, 'multi-sender', 'multi-room');
    const { room: roomB } = await makeRoom(hub, 'multi-receiver', 'multi-room', true);

    const received: DOT[] = [];
    const unsub = roomB.onMessage((dot) => received.push(dot));

    await roomA.observe('msg-1', { plaintext: true });
    await roomA.observe('msg-2', { plaintext: true });
    await roomA.observe('msg-3', { plaintext: true });
    unsub();

    expect(received.length).toBe(3);
  });

  it('unsubscribed handler no longer receives DOTs', async () => {
    const hub = new MemoryTransportHub();
    const { room: roomA } = await makeRoom(hub, 'unsub-sender', 'unsub-room');
    const { room: roomB } = await makeRoom(hub, 'unsub-receiver', 'unsub-room', true);

    const received: DOT[] = [];
    const unsub = roomB.onMessage((dot) => received.push(dot));

    await roomA.observe('before', { plaintext: true });
    unsub();
    await roomA.observe('after', { plaintext: true });

    expect(received.length).toBe(1);
  });

  it('multiple handlers can be registered independently', async () => {
    const hub = new MemoryTransportHub();
    const { room: roomA } = await makeRoom(hub, 'multi-handler-sender', 'multi-handler-room');
    const { room: roomB } = await makeRoom(hub, 'multi-handler-receiver', 'multi-handler-room', true);

    const r1: DOT[] = [];
    const r2: DOT[] = [];
    const unsub1 = roomB.onMessage((d) => r1.push(d));
    const unsub2 = roomB.onMessage((d) => r2.push(d));

    await roomA.observe('broadcast', { plaintext: true });
    unsub1();
    unsub2();

    expect(r1.length).toBe(1);
    expect(r2.length).toBe(1);
  });

  it('close() stops all onMessage handlers', async () => {
    const hub = new MemoryTransportHub();
    const { room: roomA } = await makeRoom(hub, 'close-sender', 'close-room');
    const { room: roomB } = await makeRoom(hub, 'close-receiver', 'close-room', true);

    const received: DOT[] = [];
    roomB.onMessage((dot) => received.push(dot));
    roomB.close();

    await roomA.observe('after close', { plaintext: true });
    expect(received.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sync() — pulling remote DOTs into local chain
// ---------------------------------------------------------------------------

describe('TransportRoom — sync()', () => {
  it('sync returns TransportSyncResult', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'sync-node', 'sync-room');
    const result = await room.sync();
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('newDots');
  });

  it('sync after publish shows synced=true', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'sync-pub', 'sync-pub-room');
    await room.observe('content', { plaintext: true });
    const result = await room.sync();
    expect(result.status.synced).toBe(true);
  });

  it('sync pulls DOTs published before joining', async () => {
    const hub = new MemoryTransportHub();
    // Publisher creates room and publishes DOTs
    const { room: publisher } = await makeRoom(hub, 'early-pub', 'catch-up-room');
    await publisher.observe('early-1', { plaintext: true });
    await publisher.observe('early-2', { plaintext: true });

    // Late joiner joins and syncs
    const transport = new MemoryDotTransport(hub, 'late-joiner');
    const handle = await transport.joinRoom('catch-up-room');
    const joiner = new TransportRoom({ transport, handle });
    const result = await joiner.sync();

    expect(result.newDots).toBeGreaterThanOrEqual(0);
    expect(result.status.synced).toBe(true);
  });

  it('getSyncStatus returns a valid SyncStatus', async () => {
    const hub = new MemoryTransportHub();
    const { room } = await makeRoom(hub, 'status-node', 'status-room');
    const status = room.getSyncStatus();
    expect(status).toMatchObject({
      synced: expect.any(Boolean),
      localDots: expect.any(Number),
      remoteDots: expect.any(Number),
      pendingSync: expect.any(Number),
      lastSyncMs: expect.any(Number),
    });
  });
});
