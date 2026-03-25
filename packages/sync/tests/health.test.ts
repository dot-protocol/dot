/**
 * syncHealth tests — sync layer health DOT.
 * Target: 5+ tests.
 */

import { describe, it, expect } from 'vitest';
import { createChain } from '@dot-protocol/chain';
import { ChainReplicator } from '../src/replicator.js';
import { OfflineQueue } from '../src/offline.js';
import { EphemeralManager } from '../src/ephemeral.js';
import { syncHealth } from '../src/health.js';
import { createSyncNetwork } from './helpers.js';

describe('syncHealth()', () => {
  it('produces a DOT', async () => {
    const net = await createSyncNetwork(1);
    const [peer] = net.peers;

    const replicator = new ChainReplicator({ chain: peer!.chain, node: peer!.node });
    const offline = new OfflineQueue(peer!.chain);
    const ephemeral = new EphemeralManager(createChain(), { ttlMs: 60000 });

    const dot = syncHealth(replicator, offline, ephemeral, peer!.node);
    expect(dot).toBeDefined();

    net.cleanup();
  });

  it('DOT type is "measure"', async () => {
    const net = await createSyncNetwork(1);
    const [peer] = net.peers;

    const replicator = new ChainReplicator({ chain: peer!.chain, node: peer!.node });
    const offline = new OfflineQueue(peer!.chain);
    const ephemeral = new EphemeralManager(createChain(), { ttlMs: 60000 });

    const dot = syncHealth(replicator, offline, ephemeral, peer!.node);
    expect(dot.type).toBe('measure');

    net.cleanup();
  });

  it('DOT payload is plaintext JSON', async () => {
    const net = await createSyncNetwork(1);
    const [peer] = net.peers;

    const replicator = new ChainReplicator({ chain: peer!.chain, node: peer!.node });
    const offline = new OfflineQueue(peer!.chain);
    const ephemeral = new EphemeralManager(createChain(), { ttlMs: 60000 });

    const dot = syncHealth(replicator, offline, ephemeral, peer!.node);
    expect(dot.payload_mode).toBe('plain');
    expect(dot.payload).toBeDefined();

    const text = new TextDecoder().decode(dot.payload!);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed).toBeDefined();

    net.cleanup();
  });

  it('payload contains all expected health fields', async () => {
    const net = await createSyncNetwork(2);
    const [peer] = net.peers;

    const replicator = new ChainReplicator({ chain: peer!.chain, node: peer!.node });
    const offline = new OfflineQueue(peer!.chain);
    const ephemeral = new EphemeralManager(createChain(), { ttlMs: 60000 });

    const dot = syncHealth(replicator, offline, ephemeral, peer!.node);
    const text = new TextDecoder().decode(dot.payload!);
    const report = JSON.parse(text) as Record<string, unknown>;

    expect('peers' in report).toBe(true);
    expect('lastSync' in report).toBe(true);
    expect('localTip' in report).toBe(true);
    expect('pendingOffline' in report).toBe(true);
    expect('ephemeralActive' in report).toBe(true);
    expect('ephemeralExpired' in report).toBe(true);
    expect('observed_at' in report).toBe(true);

    net.cleanup();
  });

  it('works without a node argument', async () => {
    const net = await createSyncNetwork(1);
    const [peer] = net.peers;

    const replicator = new ChainReplicator({ chain: peer!.chain, node: peer!.node });
    const offline = new OfflineQueue(peer!.chain);
    const ephemeral = new EphemeralManager(createChain(), { ttlMs: 60000 });

    // node param is optional
    const dot = syncHealth(replicator, offline, ephemeral);
    expect(dot).toBeDefined();
    expect(dot.type).toBe('measure');

    net.cleanup();
  });

  it('isOnline field reflects peer connectivity', async () => {
    const net = await createSyncNetwork(2); // 2 peers — peer[0] is online
    const [peer] = net.peers;

    const replicator = new ChainReplicator({ chain: peer!.chain, node: peer!.node });
    const offline = new OfflineQueue(peer!.chain);
    const ephemeral = new EphemeralManager(createChain(), { ttlMs: 60000 });

    const dot = syncHealth(replicator, offline, ephemeral, peer!.node);
    const text = new TextDecoder().decode(dot.payload!);
    const report = JSON.parse(text) as { isOnline: boolean };

    expect(report.isOnline).toBe(true);

    net.cleanup();
  });
});
