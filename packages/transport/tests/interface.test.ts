/**
 * interface.test.ts — Type-level and structural tests for DotTransport interface.
 *
 * These tests verify that:
 *   - The interface types compile correctly
 *   - RoomHandle / SyncStatus / Unsubscribe have the required fields
 *   - A concrete class can implement DotTransport and be used polymorphically
 */

import { describe, it, expect } from 'vitest';
import type {
  DotTransport,
  RoomHandle,
  SyncStatus,
  Unsubscribe,
} from '../src/interface.js';
import type { DOT } from '../src/interface.js';
import { MemoryDotTransport, MemoryTransportHub } from '../src/memory-transport.js';

// ---------------------------------------------------------------------------
// RoomHandle shape
// ---------------------------------------------------------------------------

describe('RoomHandle', () => {
  it('has name field as string', () => {
    const handle: RoomHandle = { name: 'test-room', id: 'abc', memberCount: 1, dotCount: 0 };
    expect(typeof handle.name).toBe('string');
  });

  it('has id field as string', () => {
    const handle: RoomHandle = { name: 'room', id: 'deadbeef'.repeat(8), memberCount: 0, dotCount: 0 };
    expect(typeof handle.id).toBe('string');
  });

  it('has memberCount as number', () => {
    const handle: RoomHandle = { name: 'room', id: 'id', memberCount: 42, dotCount: 0 };
    expect(typeof handle.memberCount).toBe('number');
  });

  it('has dotCount as number', () => {
    const handle: RoomHandle = { name: 'room', id: 'id', memberCount: 0, dotCount: 100 };
    expect(typeof handle.dotCount).toBe('number');
  });

  it('all required fields present simultaneously', () => {
    const handle: RoomHandle = {
      name: 'production-room',
      id: '0'.repeat(64),
      memberCount: 5,
      dotCount: 1000,
    };
    expect(handle.name).toBe('production-room');
    expect(handle.id).toBe('0'.repeat(64));
    expect(handle.memberCount).toBe(5);
    expect(handle.dotCount).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// SyncStatus shape
// ---------------------------------------------------------------------------

describe('SyncStatus', () => {
  it('has synced field as boolean', () => {
    const status: SyncStatus = { synced: true, localDots: 0, remoteDots: 0, pendingSync: 0, lastSyncMs: 0 };
    expect(typeof status.synced).toBe('boolean');
  });

  it('has localDots as number', () => {
    const status: SyncStatus = { synced: false, localDots: 10, remoteDots: 20, pendingSync: 10, lastSyncMs: 0 };
    expect(status.localDots).toBe(10);
  });

  it('has remoteDots as number', () => {
    const status: SyncStatus = { synced: false, localDots: 0, remoteDots: 50, pendingSync: 50, lastSyncMs: 0 };
    expect(status.remoteDots).toBe(50);
  });

  it('has pendingSync as number', () => {
    const status: SyncStatus = { synced: false, localDots: 5, remoteDots: 15, pendingSync: 10, lastSyncMs: 0 };
    expect(status.pendingSync).toBe(10);
  });

  it('has lastSyncMs as number', () => {
    const now = Date.now();
    const status: SyncStatus = { synced: true, localDots: 1, remoteDots: 1, pendingSync: 0, lastSyncMs: now };
    expect(status.lastSyncMs).toBe(now);
  });

  it('pendingSync = remoteDots - localDots for unsynced state', () => {
    const status: SyncStatus = {
      synced: false,
      localDots: 3,
      remoteDots: 10,
      pendingSync: 7,
      lastSyncMs: 0,
    };
    expect(status.pendingSync).toBe(status.remoteDots - status.localDots);
  });

  it('synced=true implies pendingSync=0', () => {
    const status: SyncStatus = {
      synced: true,
      localDots: 100,
      remoteDots: 100,
      pendingSync: 0,
      lastSyncMs: Date.now(),
    };
    expect(status.synced).toBe(true);
    expect(status.pendingSync).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe type
// ---------------------------------------------------------------------------

describe('Unsubscribe', () => {
  it('is a callable function', () => {
    const unsub: Unsubscribe = () => {};
    expect(typeof unsub).toBe('function');
  });

  it('returns void when called', () => {
    const unsub: Unsubscribe = () => {};
    const result = unsub();
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DotTransport interface — polymorphic usage
// ---------------------------------------------------------------------------

describe('DotTransport interface', () => {
  it('MemoryDotTransport satisfies DotTransport interface', () => {
    const hub = new MemoryTransportHub();
    const transport: DotTransport = new MemoryDotTransport(hub);
    // Type check: if this compiles, MemoryDotTransport implements DotTransport
    expect(transport).toBeDefined();
  });

  it('nodeId() returns a string', async () => {
    const hub = new MemoryTransportHub();
    const transport: DotTransport = new MemoryDotTransport(hub);
    expect(typeof transport.nodeId()).toBe('string');
  });

  it('interface methods are all present on concrete implementation', () => {
    const hub = new MemoryTransportHub();
    const transport: DotTransport = new MemoryDotTransport(hub);
    // All interface methods must exist
    expect(typeof transport.nodeId).toBe('function');
    expect(typeof transport.createRoom).toBe('function');
    expect(typeof transport.joinRoom).toBe('function');
    expect(typeof transport.listRooms).toBe('function');
    expect(typeof transport.publishDot).toBe('function');
    expect(typeof transport.subscribeDots).toBe('function');
    expect(typeof transport.sync).toBe('function');
    expect(typeof transport.getSyncStatus).toBe('function');
    expect(typeof transport.connectPeer).toBe('function');
    expect(typeof transport.disconnectPeer).toBe('function');
    expect(typeof transport.connectedPeers).toBe('function');
    expect(typeof transport.shutdown).toBe('function');
  });
});
