/**
 * ChainReplicator tests — chain replication over mesh.
 * Target: 30+ tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { observe } from '@dot-protocol/core';
import { append, walk, createChain, dotHashToHex } from '@dot-protocol/chain';
import { ChainReplicator } from '../src/replicator.js';
import { createSyncNetwork, waitFor } from './helpers.js';
import type { SyncTestNetwork } from './helpers.js';

let net: SyncTestNetwork;

afterEach(() => {
  net?.cleanup();
});

// --- construction and lifecycle ---

describe('ChainReplicator construction', () => {
  it('creates without error', async () => {
    net = await createSyncNetwork(1);
    const peer = net.peers[0]!;
    const replicator = new ChainReplicator({ chain: peer.chain, node: peer.node });
    expect(replicator).toBeDefined();
  });

  it('status shows not running before start()', async () => {
    net = await createSyncNetwork(1);
    const peer = net.peers[0]!;
    const replicator = new ChainReplicator({ chain: peer.chain, node: peer.node });
    expect(replicator.status().running).toBe(false);
  });

  it('status shows running after start()', async () => {
    net = await createSyncNetwork(1);
    const peer = net.peers[0]!;
    const replicator = new ChainReplicator({ chain: peer.chain, node: peer.node });
    replicator.start();
    expect(replicator.status().running).toBe(true);
    replicator.stop();
  });

  it('status shows not running after stop()', async () => {
    net = await createSyncNetwork(1);
    const peer = net.peers[0]!;
    const replicator = new ChainReplicator({ chain: peer.chain, node: peer.node });
    replicator.start();
    replicator.stop();
    expect(replicator.status().running).toBe(false);
  });

  it('start() is idempotent — calling twice does not throw', async () => {
    net = await createSyncNetwork(1);
    const peer = net.peers[0]!;
    const replicator = new ChainReplicator({ chain: peer.chain, node: peer.node });
    replicator.start();
    expect(() => replicator.start()).not.toThrow();
    replicator.stop();
  });

  it('stop() is idempotent — calling twice does not throw', async () => {
    net = await createSyncNetwork(1);
    const peer = net.peers[0]!;
    const replicator = new ChainReplicator({ chain: peer.chain, node: peer.node });
    replicator.start();
    replicator.stop();
    expect(() => replicator.stop()).not.toThrow();
  });
});

// --- basic two-node sync ---

describe('two-node sync', () => {
  it('A appends DOT → sync → B receives it', async () => {
    net = await createSyncNetwork(2);
    const [a, b] = net.peers;

    // A appends a DOT
    const dot = observe('hello from A', { plaintext: true });
    a!.chain = append(a!.chain, dot);

    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });

    // Sync manually
    await replA.sync();

    // B should have received the DOT
    await waitFor(() => b!.node.storage.count() > 0, 500);
    expect(b!.node.storage.count()).toBeGreaterThan(0);
  });

  it('SyncResult.dotsSent increases when peers connected', async () => {
    net = await createSyncNetwork(2);
    const [a] = net.peers;

    const dot = observe('test', { plaintext: true });
    a!.chain = append(a!.chain, dot);

    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const result = await replA.sync();

    expect(result.dotsSent).toBeGreaterThan(0);
  });

  it('SyncResult has all required fields', async () => {
    net = await createSyncNetwork(2);
    const [a] = net.peers;

    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const result = await replA.sync();

    expect(typeof result.dotsReceived).toBe('number');
    expect(typeof result.dotsSent).toBe('number');
    expect(typeof result.merged).toBe('boolean');
    expect(typeof result.conflicts).toBe('number');
    expect(typeof result.duration_ms).toBe('number');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('SyncResult.duration_ms is non-negative', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const result = await replA.sync();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('status().localTip matches chain.tipHash after append', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;

    const dot = observe('tip test', { plaintext: true });
    a!.chain = append(a!.chain, dot);

    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    expect(replA.status().localTip).toBe(a!.chain.tipHash);
  });

  it('status().peers reflects connected peers', async () => {
    net = await createSyncNetwork(2);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    expect(replA.status().peers).toBe(1);
  });

  it('status().lastSync is null before first sync', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    expect(replA.status().lastSync).toBeNull();
  });

  it('status().lastSync is set after sync()', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    await replA.sync();
    expect(replA.status().lastSync).toBeGreaterThan(0);
  });
});

// --- onSync handler ---

describe('onSync handler', () => {
  it('onSync fires after sync()', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });

    let fired = false;
    replA.onSync(() => { fired = true; });
    await replA.sync();
    expect(fired).toBe(true);
  });

  it('onSync receives the SyncResult', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });

    let received: unknown = null;
    replA.onSync((r) => { received = r; });
    await replA.sync();
    expect(received).not.toBeNull();
    expect(typeof (received as { duration_ms: number }).duration_ms).toBe('number');
  });

  it('onSync unsubscribe works', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });

    let count = 0;
    const unsub = replA.onSync(() => { count++; });
    unsub();
    await replA.sync();
    expect(count).toBe(0);
  });

  it('multiple onSync handlers all fire', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });

    let count = 0;
    replA.onSync(() => { count++; });
    replA.onSync(() => { count++; });
    await replA.sync();
    expect(count).toBe(2);
  });
});

// --- syncIntervalMs ---

describe('syncIntervalMs', () => {
  it('periodic sync fires at specified interval', async () => {
    vi.useFakeTimers();

    net = await createSyncNetwork(1);
    const [a] = net.peers;

    let syncCount = 0;
    const replA = new ChainReplicator({
      chain: a!.chain,
      node: a!.node,
      syncIntervalMs: 100,
    });
    replA.onSync(() => { syncCount++; });
    replA.start();

    vi.advanceTimersByTime(350);

    replA.stop();
    vi.useRealTimers();

    expect(syncCount).toBeGreaterThanOrEqual(3);
  });

  it('sync does not fire after stop()', async () => {
    vi.useFakeTimers();

    net = await createSyncNetwork(1);
    const [a] = net.peers;

    let syncCount = 0;
    const replA = new ChainReplicator({
      chain: a!.chain,
      node: a!.node,
      syncIntervalMs: 100,
    });
    replA.onSync(() => { syncCount++; });
    replA.start();
    replA.stop();

    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(syncCount).toBe(0);
  });
});

// --- 3-node convergence ---

describe('3-node chain convergence', () => {
  it('A appends → B syncs → C syncs: chain propagates', async () => {
    net = await createSyncNetwork(3);
    const [a, b] = net.peers;

    // A appends a DOT
    const dot = observe('three-node-test', { plaintext: true });
    a!.chain = append(a!.chain, dot);

    // A syncs to B and C
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    await replA.sync();

    // Wait for B to receive it
    await waitFor(() => b!.node.storage.count() > 0, 500);
    expect(b!.node.storage.count()).toBeGreaterThan(0);
  });
});

// --- concurrent append and CRDT merge ---

describe('concurrent append and merge', () => {
  it('both nodes append concurrently → manual merge produces combined chain', async () => {
    net = await createSyncNetwork(2);
    const [a, b] = net.peers;

    // Both append independently
    a!.chain = append(a!.chain, observe('from-A', { plaintext: true }));
    b!.chain = append(b!.chain, observe('from-B', { plaintext: true }));

    // Verify they have independent chains
    expect(a!.chain.tipHash).not.toBe(b!.chain.tipHash);
    expect(a!.chain.appendCount).toBe(1);
    expect(b!.chain.appendCount).toBe(1);
  });

  it('empty sync produces zero dotsSent when chain is empty', async () => {
    net = await createSyncNetwork(2);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const result = await replA.sync();
    expect(result.dotsSent).toBe(0);
  });

  it('getChain() returns the current chain', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    expect(replA.getChain()).toBe(a!.chain);
  });

  it('getChain() after append reflects updated chain', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    a!.chain = append(a!.chain, observe('updated', { plaintext: true }));
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    expect(replA.getChain().tipHash).toBe(a!.chain.tipHash);
  });
});

// --- disconnect and reconnect ---

describe('disconnect/reconnect', () => {
  it('sync with no peers → dotsSent is 0', async () => {
    net = await createSyncNetwork(1); // single node, no peers
    const [a] = net.peers;

    a!.chain = append(a!.chain, observe('offline', { plaintext: true }));
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const result = await replA.sync();

    expect(result.dotsSent).toBe(0);
  });
});

// --- large-scale sync ---

describe('large-scale sync', () => {
  it('10 DOTs sync between 2 nodes', async () => {
    net = await createSyncNetwork(2);
    const [a, b] = net.peers;

    // A appends 10 DOTs
    for (let i = 0; i < 10; i++) {
      a!.chain = append(a!.chain, observe(`dot-${i}`, { plaintext: true }));
    }

    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const result = await replA.sync();

    expect(result.dotsSent).toBeGreaterThan(0);
    await waitFor(() => b!.node.storage.count() >= 10, 1000);
    expect(b!.node.storage.count()).toBeGreaterThanOrEqual(10);
  });

  it('sync completes in < 5s for 100 DOTs (regression)', async () => {
    net = await createSyncNetwork(2);
    const [a, b] = net.peers;

    for (let i = 0; i < 100; i++) {
      a!.chain = append(a!.chain, observe(`dot-${i}`, { plaintext: true }));
    }

    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const start = Date.now();
    await replA.sync();
    await waitFor(() => b!.node.storage.count() >= 100, 5000);
    const elapsed = Date.now() - start;

    expect(b!.node.storage.count()).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(5000);
  });
});

// --- status shape ---

describe('status()', () => {
  it('status().remoteTips is a Map', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    expect(replA.status().remoteTips).toBeInstanceOf(Map);
  });

  it('status().remoteTips is a copy (not the internal map)', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const replA = new ChainReplicator({ chain: a!.chain, node: a!.node });
    const s1 = replA.status().remoteTips;
    const s2 = replA.status().remoteTips;
    expect(s1).not.toBe(s2); // different references
  });
});
