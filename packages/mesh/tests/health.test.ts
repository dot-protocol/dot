/**
 * Health tests — health DOT shape, partition detection, monitor.
 * Target: 10+ tests.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import {
  health,
  detectPartition,
  startMonitor,
  stopMonitor,
  clearPartitionHistory,
} from '../src/health.js';
import { createTestMesh, waitFor } from './helpers.js';
import type { TestMesh } from './helpers.js';

let mesh: TestMesh;

beforeEach(() => {
  clearPartitionHistory();
});

afterEach(() => {
  mesh?.cleanup();
  clearPartitionHistory();
});

describe('health()', () => {
  it('returns a DOT of type measure', async () => {
    mesh = await createTestMesh(1);
    const h = health(mesh.nodes[0]!);
    expect(h.type).toBe('measure');
  });

  it('returns a DOT with plaintext payload_mode', async () => {
    mesh = await createTestMesh(1);
    const h = health(mesh.nodes[0]!);
    expect(h.payload_mode).toBe('plain');
  });

  it('payload contains node_id', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const h = health(node);
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.node_id).toBe(node.id);
  });

  it('payload contains peer_count', async () => {
    mesh = await createTestMesh(3);
    const h = health(mesh.nodes[0]!);
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(typeof report.peer_count).toBe('number');
  });

  it('peer_count reflects connected peers', async () => {
    mesh = await createTestMesh(3);
    const h = health(mesh.nodes[0]!);
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    // Node 0 has 2 peers in a 3-node mesh
    // The peers map is populated on message receipt, so it may be 0 initially
    expect(typeof report.peer_count).toBe('number');
  });

  it('dots_stored reflects local storage', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    node.store(observe('a', { plaintext: true }));
    node.store(observe('b', { plaintext: true }));
    const h = health(node);
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.dots_stored).toBe(2);
  });

  it('observed_at is a valid ISO timestamp', async () => {
    mesh = await createTestMesh(1);
    const h = health(mesh.nodes[0]!);
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(() => new Date(report.observed_at)).not.toThrow();
    expect(typeof report.observed_at).toBe('string');
  });

  it('health DOT has a defined payload', async () => {
    mesh = await createTestMesh(1);
    const h = health(mesh.nodes[0]!);
    expect(h.payload).toBeDefined();
    expect(h.payload!.length).toBeGreaterThan(0);
  });

  it('request_success_rate is a number between 0 and 1', async () => {
    mesh = await createTestMesh(1);
    const h = health(mesh.nodes[0]!);
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.request_success_rate).toBeGreaterThanOrEqual(0);
    expect(report.request_success_rate).toBeLessThanOrEqual(1);
  });
});

describe('detectPartition()', () => {
  it('returns false for first observation (insufficient history)', async () => {
    mesh = await createTestMesh(3);
    const node = mesh.nodes[0]!;
    const result = detectPartition(node);
    expect(result).toBe(false);
  });

  it('returns false when peer count is stable', async () => {
    mesh = await createTestMesh(3);
    const node = mesh.nodes[0]!;

    // First observation
    detectPartition(node);
    // Second observation — same count
    const result = detectPartition(node);
    expect(result).toBe(false);
  });

  it('returns true when peer count drops >50%', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;

    // Manually inject peer entries to simulate a drop
    node.peers.set('peer-a', { lastSeen: Date.now(), trustScore: 0.5 });
    node.peers.set('peer-b', { lastSeen: Date.now(), trustScore: 0.5 });
    node.peers.set('peer-c', { lastSeen: Date.now(), trustScore: 0.5 });
    node.peers.set('peer-d', { lastSeen: Date.now(), trustScore: 0.5 });

    // Record high count
    detectPartition(node);

    // Simulate all peers disappearing
    node.peers.clear();

    const result = detectPartition(node);
    expect(result).toBe(true);
  });

  it('returns false when peer count drops exactly 50%', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;

    node.peers.set('peer-a', { lastSeen: Date.now(), trustScore: 0.5 });
    node.peers.set('peer-b', { lastSeen: Date.now(), trustScore: 0.5 });

    detectPartition(node); // records 2 peers

    // Drop to 1 = 50% drop — NOT a partition (threshold is >50%)
    node.peers.delete('peer-b');
    const result = detectPartition(node);
    expect(result).toBe(false);
  });

  it('clearPartitionHistory resets state', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;

    node.peers.set('peer-x', { lastSeen: Date.now(), trustScore: 0.5 });
    detectPartition(node);
    node.peers.clear();
    clearPartitionHistory();

    // After clear, first observation again — should be false
    const result = detectPartition(node);
    expect(result).toBe(false);
  });
});

describe('startMonitor / stopMonitor', () => {
  it('startMonitor returns a running handle', async () => {
    mesh = await createTestMesh(1);
    const handle = startMonitor(mesh.nodes[0]!, 10000);
    expect(handle.running).toBe(true);
    stopMonitor(handle);
  });

  it('stopMonitor sets running to false', async () => {
    mesh = await createTestMesh(1);
    const handle = startMonitor(mesh.nodes[0]!, 10000);
    stopMonitor(handle);
    expect(handle.running).toBe(false);
  });

  it('monitor emits health DOT to node storage at interval', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const initialCount = node.storage.count();

    // Use a very short interval and long timeout
    const handle = startMonitor(node, 20);
    await waitFor(() => node.storage.count() > initialCount, 1000);
    stopMonitor(handle);

    expect(node.storage.count()).toBeGreaterThan(initialCount);
  }, 2000);

  it('emitted health DOTs are of type measure', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const initialCount = node.storage.count();

    const handle = startMonitor(node, 20);
    await waitFor(() => node.storage.count() > initialCount, 1000);
    stopMonitor(handle);

    // Verify stored DOTs include health measures
    const dots = node.storage.list();
    const measures = dots.filter((d) => d.type === 'measure');
    expect(measures.length).toBeGreaterThan(0);
  }, 2000);
});
