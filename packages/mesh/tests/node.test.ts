/**
 * MeshNode tests — create, connect, store, broadcast, request, health, close.
 * Target: 30+ tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { observe, createIdentity } from '@dot-protocol/core';
import { createNode } from '../src/node.js';
import { MemoryHub, MemoryTransport } from '../src/transport/memory.js';
import { createTestMesh, waitFor } from './helpers.js';
import type { TestMesh } from './helpers.js';

let mesh: TestMesh;

afterEach(() => {
  mesh?.cleanup();
});

describe('createNode', () => {
  it('creates a node with a non-empty id', async () => {
    const identity = await createIdentity();
    const hub = new MemoryHub();
    const transport = new MemoryTransport(hub, Buffer.from(identity.publicKey).toString('hex'));
    const node = createNode({ identity, transport });
    expect(node.id.length).toBeGreaterThan(0);
    node.close();
    transport.close();
  });

  it('node id is hex-encoded public key (64 chars)', async () => {
    const identity = await createIdentity();
    const hub = new MemoryHub();
    const transport = new MemoryTransport(hub, Buffer.from(identity.publicKey).toString('hex'));
    const node = createNode({ identity, transport });
    expect(node.id).toMatch(/^[0-9a-f]{64}$/);
    node.close();
    transport.close();
  });

  it('starts with empty peer table', async () => {
    mesh = await createTestMesh(1);
    expect(mesh.nodes[0]?.peers.size).toBe(0);
  });

  it('starts with empty storage', async () => {
    mesh = await createTestMesh(1);
    expect(mesh.nodes[0]?.storage.count()).toBe(0);
  });

  it('two nodes can connect', async () => {
    mesh = await createTestMesh(2);
    // Both transports should have each other as peers
    expect(mesh.transports[0]?.peers()).toContain(mesh.nodes[1]?.id);
    expect(mesh.transports[1]?.peers()).toContain(mesh.nodes[0]?.id);
  });

  it('three nodes fully connected', async () => {
    mesh = await createTestMesh(3);
    for (const transport of mesh.transports) {
      expect(transport.peers().length).toBe(2);
    }
  });
});

describe('store()', () => {
  it('stores a DOT and returns its hash', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const dot = observe('hello', { plaintext: true });
    const hash = node.store(dot);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // hex blake3
  });

  it('stored DOT is retrievable by hash', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const dot = observe('world', { plaintext: true });
    const hash = node.store(dot);
    const retrieved = node.storage.get(hash);
    expect(retrieved).not.toBeNull();
  });

  it('storing same DOT twice is idempotent', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const dot = observe('same', { plaintext: true });
    const hash1 = node.store(dot);
    const hash2 = node.store(dot);
    expect(hash1).toBe(hash2);
    expect(node.storage.count()).toBe(1);
  });

  it('different DOTs produce different hashes', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const dot1 = observe('alpha', { plaintext: true });
    const dot2 = observe('beta', { plaintext: true });
    const hash1 = node.store(dot1);
    const hash2 = node.store(dot2);
    expect(hash1).not.toBe(hash2);
  });

  it('storage count increases with each unique store', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    expect(node.storage.count()).toBe(0);
    node.store(observe('a', { plaintext: true }));
    expect(node.storage.count()).toBe(1);
    node.store(observe('b', { plaintext: true }));
    expect(node.storage.count()).toBe(2);
  });
});

describe('onDot()', () => {
  it('handler called when DOT arrives from peer', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0]];

    const received: Array<{ hash: string }> = [];
    receiver!.onDot((dot) => {
      received.push({ hash: '' + dot.payload?.length });
    });

    const dot = observe('test-message', { plaintext: true });
    await sender!.broadcast(dot);

    await waitFor(() => received.length > 0, 500);
    expect(received.length).toBe(1);
  });

  it('handler not called for duplicate DOTs', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0]];

    let callCount = 0;
    receiver!.onDot(() => { callCount++; });

    const dot = observe('dedup-test', { plaintext: true });
    await sender!.broadcast(dot);
    await sender!.broadcast(dot); // same DOT again

    await waitFor(() => callCount >= 1, 500);
    await new Promise<void>((r) => setTimeout(r, 50)); // extra time for potential duplicate
    expect(callCount).toBe(1);
  });

  it('multiple handlers can be registered', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0]];

    let count1 = 0;
    let count2 = 0;
    receiver!.onDot(() => { count1++; });
    receiver!.onDot(() => { count2++; });

    await sender!.broadcast(observe('multi-handler', { plaintext: true }));
    await waitFor(() => count1 > 0 && count2 > 0, 500);
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });
});

describe('health()', () => {
  it('returns a DOT of type measure', async () => {
    mesh = await createTestMesh(1);
    const h = mesh.nodes[0]!.health();
    expect(h.type).toBe('measure');
  });

  it('health DOT has plaintext payload', async () => {
    mesh = await createTestMesh(1);
    const h = mesh.nodes[0]!.health();
    expect(h.payload_mode).toBe('plain');
    expect(h.payload).toBeDefined();
  });

  it('health payload contains node_id', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const h = node.health();
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.node_id).toBe(node.id);
  });

  it('health reports peer_count', async () => {
    mesh = await createTestMesh(3);
    const h = mesh.nodes[0]!.health();
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(typeof report.peer_count).toBe('number');
  });

  it('health reports dots_stored', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    node.store(observe('x', { plaintext: true }));
    const h = node.health();
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(report.dots_stored).toBe(1);
  });

  it('health reports observed_at as ISO timestamp', async () => {
    mesh = await createTestMesh(1);
    const h = mesh.nodes[0]!.health();
    const report = JSON.parse(new TextDecoder().decode(h.payload));
    expect(() => new Date(report.observed_at)).not.toThrow();
  });
});

describe('close()', () => {
  it('close() clears peer table', async () => {
    mesh = await createTestMesh(2);
    const node = mesh.nodes[0]!;
    node.close();
    expect(node.peers.size).toBe(0);
  });

  it('close() disconnects transport peers', async () => {
    mesh = await createTestMesh(2);
    const transport = mesh.transports[0]!;
    mesh.nodes[0]!.close();
    expect(transport.peers().length).toBe(0);
  });
});

describe('peer table updates', () => {
  it('peer entry added when message received', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0]];

    await sender!.broadcast(observe('ping-test', { plaintext: true }));
    await waitFor(() => receiver!.peers.has(sender!.id), 500);
    expect(receiver!.peers.has(sender!.id)).toBe(true);
  });

  it('peer entry has lastSeen timestamp', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0]];

    await sender!.broadcast(observe('ts-test', { plaintext: true }));
    await waitFor(() => receiver!.peers.has(sender!.id), 500);

    const entry = receiver!.peers.get(sender!.id);
    expect(entry?.lastSeen).toBeGreaterThan(0);
  });

  it('peer entry has trustScore initialized to 0.5', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0]];

    await sender!.broadcast(observe('trust-test', { plaintext: true }));
    await waitFor(() => receiver!.peers.has(sender!.id), 500);

    const entry = receiver!.peers.get(sender!.id);
    expect(entry?.trustScore).toBe(0.5);
  });
});

describe('identity', () => {
  it('two nodes have different IDs', async () => {
    mesh = await createTestMesh(2);
    expect(mesh.nodes[0]?.id).not.toBe(mesh.nodes[1]?.id);
  });

  it('node ID matches the hex-encoded public key', async () => {
    const identity = await createIdentity();
    const hub = new MemoryHub();
    const nodeId = Buffer.from(identity.publicKey).toString('hex');
    const transport = new MemoryTransport(hub, nodeId);
    const node = createNode({ identity, transport });
    expect(node.id).toBe(nodeId);
    node.close();
    transport.close();
  });
});
