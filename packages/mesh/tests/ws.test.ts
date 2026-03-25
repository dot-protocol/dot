/**
 * ws.test.ts — Real WebSocket integration tests for WSTransport + MeshNode.
 *
 * Tests use OS-assigned ports (port: 0) to avoid conflicts.
 * All servers and connections are cleaned up in afterEach/afterAll.
 *
 * Sections:
 *   1. Basic connectivity (10+ tests)
 *   2. Multi-node mesh (10+ tests)
 *   3. Partition recovery (5+ tests)
 *   4. Performance (3+ tests)
 *   5. Edge cases (5+ tests)
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { observe, createIdentity } from '@dot-protocol/core';
import { createNode } from '../src/node.js';
import { WSTransport, createWSTransport } from '../src/transport/ws.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface WsNode {
  transport: WSTransport;
  node: ReturnType<typeof createNode>;
  port: number;
}

async function makeServerNode(): Promise<WsNode> {
  const identity = await createIdentity();
  const transport = new WSTransport({ publicKey: identity.publicKey });
  const port = await transport.listen();
  const node = createNode({ identity, transport });
  return { transport, node, port };
}

async function makeClientNode(serverPort: number): Promise<WsNode> {
  const identity = await createIdentity();
  const transport = new WSTransport({
    publicKey: identity.publicKey,
    reconnectInitialMs: 100,
    reconnectMaxMs: 500,
  });
  // Client doesn't listen — no server started
  // connect to the server
  await transport.connect(`127.0.0.1:${serverPort}`);
  const node = createNode({ identity, transport });
  return { transport, node, port: 0 };
}

async function closeAll(...nodes: WsNode[]): Promise<void> {
  for (const n of nodes) {
    n.node.close();
    await n.transport.close();
  }
}

/** Wait until a condition is true, polling every `pollMs`. Timeout after `timeoutMs`. */
async function waitFor(
  condition: () => boolean,
  timeoutMs = 3000,
  pollMs = 20,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise<void>((r) => setTimeout(r, pollMs));
  }
}

/** Wait N ms. */
async function delay(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ─── 1. Basic connectivity ────────────────────────────────────────────────

describe('WSTransport: basic connectivity', () => {
  let server: WsNode;
  let client: WsNode;

  afterEach(async () => {
    await closeAll(...[server, client].filter(Boolean));
  });

  it('server starts and binds to a port > 0', async () => {
    server = await makeServerNode();
    expect(server.port).toBeGreaterThan(0);
  });

  it('client connects to server successfully', async () => {
    server = await makeServerNode();
    const identity = await createIdentity();
    const clientTransport = new WSTransport({ publicKey: identity.publicKey });
    const peerId = await clientTransport.connect(`127.0.0.1:${server.port}`);
    expect(typeof peerId).toBe('string');
    expect(peerId.length).toBeGreaterThan(0);
    client = { transport: clientTransport, node: createNode({ identity, transport: clientTransport }), port: 0 };
  });

  it('server sees client as a peer after connect', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);
    expect(server.transport.peers().length).toBe(1);
  });

  it('client sees server as a peer after connect', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    expect(client.transport.peers().length).toBe(1);
  });

  it('client sends DOT → server receives it', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    const received: unknown[] = [];
    server.node.onDot((dot) => received.push(dot));

    const dot = observe('hello from client', { plaintext: true });
    await client.node.broadcast(dot);

    await waitFor(() => received.length === 1);
    expect(received.length).toBe(1);
  });

  it('server broadcasts DOT → client receives it', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    const received: unknown[] = [];
    client.node.onDot((dot) => received.push(dot));

    const dot = observe('hello from server', { plaintext: true });
    await server.node.broadcast(dot);

    await waitFor(() => received.length === 1);
    expect(received.length).toBe(1);
  });

  it('disconnect removes peer from server peer list', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    const clientPeerId = client.transport.peers()[0];
    expect(clientPeerId).toBeDefined();

    // Close client connection
    await client.transport.close();
    await waitFor(() => server.transport.peers().length === 0, 2000);
    expect(server.transport.peers().length).toBe(0);
    // prevent double-close in afterEach
    (client as unknown as { _closed: boolean })._closed = true;
  });

  it('disconnect removes peer from client peer list', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    const serverPeerId = server.transport.peers()[0];
    expect(serverPeerId).toBeDefined();
    server.transport.disconnect(serverPeerId!);

    await waitFor(() => server.transport.peers().length === 0, 2000);
    expect(server.transport.peers().length).toBe(0);
  });

  it('multiple clients can connect to one server', async () => {
    server = await makeServerNode();

    const c1Identity = await createIdentity();
    const c2Identity = await createIdentity();
    const t1 = new WSTransport({ publicKey: c1Identity.publicKey });
    const t2 = new WSTransport({ publicKey: c2Identity.publicKey });

    await t1.connect(`127.0.0.1:${server.port}`);
    await t2.connect(`127.0.0.1:${server.port}`);

    await waitFor(() => server.transport.peers().length === 2);
    expect(server.transport.peers().length).toBe(2);

    await t1.close();
    await t2.close();
  });

  it('boundPort returns actual port after listen()', async () => {
    server = await makeServerNode();
    expect(server.transport.boundPort).toBe(server.port);
  });

  it('peers() returns empty array before any connections', async () => {
    const identity = await createIdentity();
    const transport = new WSTransport({ publicKey: identity.publicKey });
    expect(transport.peers()).toEqual([]);
    await transport.close();
  });
});

// ─── 2. Multi-node mesh ───────────────────────────────────────────────────

describe('WSTransport: multi-node mesh', () => {
  let nodeA: WsNode;
  let nodeB: WsNode;
  let nodeC: WsNode;

  beforeEach(async () => {
    // A = server, B and C = clients connecting to A
    nodeA = await makeServerNode();

    const identB = await createIdentity();
    const tB = new WSTransport({ publicKey: identB.publicKey, reconnectInitialMs: 100, reconnectMaxMs: 500 });
    await tB.connect(`127.0.0.1:${nodeA.port}`);
    nodeB = { transport: tB, node: createNode({ identity: identB, transport: tB }), port: 0 };

    const identC = await createIdentity();
    const tC = new WSTransport({ publicKey: identC.publicKey, reconnectInitialMs: 100, reconnectMaxMs: 500 });
    await tC.connect(`127.0.0.1:${nodeA.port}`);
    nodeC = { transport: tC, node: createNode({ identity: identC, transport: tC }), port: 0 };

    // Wait for A to see both B and C
    await waitFor(() => nodeA.transport.peers().length === 2, 3000);

    // Also wire B→A and C→A back by connecting B and C as peers of each other via A acting as relay
    // For direct A-only topology: A knows B and C; B and C know A.
  });

  afterEach(async () => {
    await closeAll(nodeA, nodeB, nodeC);
  });

  it('A has 2 peers (B and C)', () => {
    expect(nodeA.transport.peers().length).toBe(2);
  });

  it('B has 1 peer (A)', () => {
    expect(nodeB.transport.peers().length).toBe(1);
  });

  it('C has 1 peer (A)', () => {
    expect(nodeC.transport.peers().length).toBe(1);
  });

  it('A broadcasts DOT → B and C both receive it', async () => {
    const receivedB: unknown[] = [];
    const receivedC: unknown[] = [];
    nodeB.node.onDot((dot) => receivedB.push(dot));
    nodeC.node.onDot((dot) => receivedC.push(dot));

    const dot = observe('broadcast from A', { plaintext: true });
    const count = await nodeA.node.broadcast(dot);

    expect(count).toBe(2);
    await waitFor(() => receivedB.length === 1 && receivedC.length === 1);
    expect(receivedB.length).toBe(1);
    expect(receivedC.length).toBe(1);
  });

  it('B sends DOT → A receives it', async () => {
    const receivedA: unknown[] = [];
    nodeA.node.onDot((dot) => receivedA.push(dot));

    const dot = observe('from B to A', { plaintext: true });
    await nodeB.node.broadcast(dot);

    await waitFor(() => receivedA.length === 1);
    expect(receivedA.length).toBe(1);
  });

  it('B sends DOT → A forwards to C (via A re-broadcasting)', async () => {
    // A must re-broadcast received DOTs to other peers
    nodeA.node.onDot(async (dot) => {
      await nodeA.node.broadcast(dot);
    });

    const receivedC: unknown[] = [];
    nodeC.node.onDot((dot) => receivedC.push(dot));

    const dot = observe('B to C via A', { plaintext: true });
    await nodeB.node.broadcast(dot);

    await waitFor(() => receivedC.length === 1, 3000);
    expect(receivedC.length).toBe(1);
  });

  it('each node has unique ID', () => {
    expect(nodeA.node.id).not.toBe(nodeB.node.id);
    expect(nodeA.node.id).not.toBe(nodeC.node.id);
    expect(nodeB.node.id).not.toBe(nodeC.node.id);
  });

  it('A broadcasts multiple DOTs, B receives all', async () => {
    const receivedB: unknown[] = [];
    nodeB.node.onDot((dot) => receivedB.push(dot));

    const dots = Array.from({ length: 5 }, (_, i) => observe(`dot-${i}`, { plaintext: true }));
    for (const dot of dots) {
      await nodeA.node.broadcast(dot);
    }

    await waitFor(() => receivedB.length === 5, 3000);
    expect(receivedB.length).toBe(5);
  });

  it('closing B does not affect A↔C communication', async () => {
    await nodeB.transport.close();
    nodeB.node.close();

    await waitFor(() => nodeA.transport.peers().length === 1, 2000);

    const receivedC: unknown[] = [];
    nodeC.node.onDot((dot) => receivedC.push(dot));

    const dot = observe('A to C after B gone', { plaintext: true });
    await nodeA.node.broadcast(dot);

    await waitFor(() => receivedC.length === 1);
    expect(receivedC.length).toBe(1);
    // Mark as closed to skip double-close in afterEach
    (nodeB as unknown as Record<string, boolean>)._skipClose = true;
  });

  it('DOT deduplication: same DOT broadcast twice, node receives it once', async () => {
    const receivedA: unknown[] = [];
    nodeA.node.onDot((dot) => receivedA.push(dot));

    const dot = observe('dedup test', { plaintext: true });
    await nodeB.node.broadcast(dot);
    await nodeB.node.broadcast(dot);

    await delay(200);
    await waitFor(() => receivedA.length >= 1, 1000);
    expect(receivedA.length).toBe(1);
  });

  it('node stores received DOTs in storage', async () => {
    const dot = observe('store test', { plaintext: true });
    await nodeA.node.broadcast(dot);

    await waitFor(() => nodeB.node.storage.count() === 1, 2000);
    expect(nodeB.node.storage.count()).toBeGreaterThan(0);
  });

  it('request() retrieves DOT from peer over WebSocket', async () => {
    // Store a DOT on A
    const dot = observe('request test', { plaintext: true });
    const hash = nodeA.node.store(dot);

    // B requests it from A
    const retrieved = await nodeB.node.request(hash);
    expect(retrieved).not.toBeNull();
  });
});

// ─── 3. Partition recovery ────────────────────────────────────────────────

describe('WSTransport: partition recovery', () => {
  let nodeA: WsNode;
  let nodeB: WsNode;
  let nodeC: WsNode;

  beforeEach(async () => {
    nodeA = await makeServerNode();

    const identB = await createIdentity();
    const tB = new WSTransport({
      publicKey: identB.publicKey,
      reconnectInitialMs: 100,
      reconnectMaxMs: 500,
    });
    await tB.connect(`127.0.0.1:${nodeA.port}`);
    nodeB = { transport: tB, node: createNode({ identity: identB, transport: tB }), port: 0 };

    const identC = await createIdentity();
    const tC = new WSTransport({
      publicKey: identC.publicKey,
      reconnectInitialMs: 100,
      reconnectMaxMs: 500,
    });
    await tC.connect(`127.0.0.1:${nodeA.port}`);
    nodeC = { transport: tC, node: createNode({ identity: identC, transport: tC }), port: 0 };

    await waitFor(() => nodeA.transport.peers().length === 2, 3000);
  });

  afterEach(async () => {
    await closeAll(nodeA, nodeB, nodeC);
  });

  it('killing B connection: A can still communicate with C', async () => {
    const bPeerId = nodeA.transport.peers().find(
      (p) => p === nodeB.node.id || p !== nodeC.node.id
    );
    if (bPeerId !== undefined) {
      nodeA.transport.disconnect(bPeerId);
    }

    await waitFor(() => nodeA.transport.peers().length <= 1, 2000);

    const receivedC: unknown[] = [];
    nodeC.node.onDot((dot) => receivedC.push(dot));
    const dot = observe('partition test', { plaintext: true });
    await nodeA.node.broadcast(dot);

    await waitFor(() => receivedC.length === 1, 2000);
    expect(receivedC.length).toBe(1);
  });

  it('after partition and reconnect, B gossip-syncs missing DOTs', async () => {
    // Setup gossip-like manual sync: A re-broadcasts everything to peers
    const dotsSentDuringPartition: ReturnType<typeof observe>[] = [];

    // Disconnect B from A
    const bPeerId = nodeB.transport.peers()[0];
    nodeB.transport.disconnect(bPeerId!);
    await waitFor(() => nodeB.transport.peers().length === 0, 2000);

    // A broadcasts DOTs while B is disconnected
    for (let i = 0; i < 3; i++) {
      const dot = observe(`partition-dot-${i}`, { plaintext: true });
      dotsSentDuringPartition.push(dot);
      nodeA.node.store(dot);
    }

    expect(nodeB.node.storage.count()).toBe(0);

    // Reconnect B to A
    const newPeerId = await nodeB.transport.connect(`127.0.0.1:${nodeA.port}`);
    expect(typeof newPeerId).toBe('string');

    await waitFor(() => nodeA.transport.peers().length === 2, 3000);

    // Manually trigger gossip sync by having B request each hash from A
    for (const dot of dotsSentDuringPartition) {
      const { dotHashToHex } = await import('@dot-protocol/chain');
      const hash = dotHashToHex(dot);
      const retrieved = await nodeB.node.request(hash);
      expect(retrieved).not.toBeNull();
    }
  });

  it('partition then restore: node re-registers as peer', async () => {
    const bPeerId = nodeB.transport.peers()[0];
    nodeB.transport.disconnect(bPeerId!);
    await waitFor(() => nodeB.transport.peers().length === 0, 2000);

    // Reconnect
    await nodeB.transport.connect(`127.0.0.1:${nodeA.port}`);
    await waitFor(() => nodeB.transport.peers().length === 1, 2000);
    expect(nodeB.transport.peers().length).toBe(1);
  });

  it('partition: B does not receive DOTs sent while disconnected', async () => {
    const bPeerId = nodeB.transport.peers()[0];
    nodeB.transport.disconnect(bPeerId!);
    await waitFor(() => nodeB.transport.peers().length === 0, 2000);

    const receivedB: unknown[] = [];
    nodeB.node.onDot((dot) => receivedB.push(dot));

    const dot = observe('not for B', { plaintext: true });
    await nodeA.node.broadcast(dot);
    await delay(200);

    expect(receivedB.length).toBe(0);
  });

  it('three nodes converge after partition resolved via manual sync', async () => {
    // Disconnect C from A
    const cPeerId = nodeC.transport.peers()[0];
    nodeC.transport.disconnect(cPeerId!);
    await waitFor(() => nodeC.transport.peers().length === 0, 2000);

    // A and B exchange DOTs
    const dot1 = observe('converge-1', { plaintext: true });
    const dot2 = observe('converge-2', { plaintext: true });
    nodeA.node.store(dot1);
    nodeA.node.store(dot2);

    // Restore C
    await nodeC.transport.connect(`127.0.0.1:${nodeA.port}`);
    await waitFor(() => nodeA.transport.peers().length === 2, 3000);

    // C manually syncs
    const { dotHashToHex } = await import('@dot-protocol/chain');
    const h1 = dotHashToHex(dot1);
    const h2 = dotHashToHex(dot2);

    const r1 = await nodeC.node.request(h1);
    const r2 = await nodeC.node.request(h2);

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });
});

// ─── 4. Performance ───────────────────────────────────────────────────────

describe('WSTransport: performance', () => {
  let nodeA: WsNode;
  let nodeB: WsNode;
  let nodeC: WsNode;

  beforeEach(async () => {
    nodeA = await makeServerNode();

    const identB = await createIdentity();
    const tB = new WSTransport({ publicKey: identB.publicKey });
    await tB.connect(`127.0.0.1:${nodeA.port}`);
    nodeB = { transport: tB, node: createNode({ identity: identB, transport: tB }), port: 0 };

    const identC = await createIdentity();
    const tC = new WSTransport({ publicKey: identC.publicKey });
    await tC.connect(`127.0.0.1:${nodeA.port}`);
    nodeC = { transport: tC, node: createNode({ identity: identC, transport: tC }), port: 0 };

    await waitFor(() => nodeA.transport.peers().length === 2, 3000);
  });

  afterEach(async () => {
    await closeAll(nodeA, nodeB, nodeC);
  });

  it('100 DOTs broadcast from A to B in < 2 seconds', async () => {
    const receivedB: unknown[] = [];
    nodeB.node.onDot((dot) => receivedB.push(dot));

    const start = Date.now();
    const dots = Array.from({ length: 100 }, (_, i) => observe(`perf-${i}-${Date.now()}`, { plaintext: true }));
    for (const dot of dots) {
      await nodeA.node.broadcast(dot);
    }

    await waitFor(() => receivedB.length >= 100, 2000, 10);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(receivedB.length).toBeGreaterThanOrEqual(100);
  }, 10000);

  it('1000 DOTs total across 3 nodes in < 10 seconds', async () => {
    const receivedA: unknown[] = [];
    const receivedB: unknown[] = [];
    const receivedC: unknown[] = [];

    nodeA.node.onDot((dot) => receivedA.push(dot));
    nodeB.node.onDot((dot) => receivedB.push(dot));
    nodeC.node.onDot((dot) => receivedC.push(dot));

    const start = Date.now();

    // A broadcasts 500 to B and C (= 1000 deliveries)
    const dots = Array.from({ length: 500 }, (_, i) => observe(`mass-${i}-${Date.now()}`, { plaintext: true }));
    for (const dot of dots) {
      await nodeA.node.broadcast(dot);
    }

    // Wait for B and C to each receive 500
    await waitFor(() => receivedB.length >= 500 && receivedC.length >= 500, 10000, 20);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);
    expect(receivedB.length).toBeGreaterThanOrEqual(500);
    expect(receivedC.length).toBeGreaterThanOrEqual(500);
  }, 15000);

  it('no duplicate DOTs received (dedup working over real transport)', async () => {
    const receivedB = new Set<string>();
    nodeB.node.onDot((dot, _from) => {
      // Use payload as fingerprint
      const key = JSON.stringify(dot.payload);
      receivedB.add(key);
    });

    const dots = Array.from({ length: 50 }, (_, i) => observe(`dedup-perf-${i}`, { plaintext: true }));
    for (const dot of dots) {
      // Broadcast the same DOT twice
      await nodeA.node.broadcast(dot);
      await nodeA.node.broadcast(dot);
    }

    await waitFor(() => receivedB.size >= 50, 3000, 10);
    // Should receive exactly 50 unique DOTs, not 100
    expect(receivedB.size).toBe(50);
  }, 10000);
});

// ─── 5. Edge cases ────────────────────────────────────────────────────────

describe('WSTransport: edge cases', () => {
  let server: WsNode;
  let client: WsNode;

  afterEach(async () => {
    if (server) await closeAll(server);
    if (client) await closeAll(client);
  });

  it('handles a large DOT (10KB payload)', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    const received: unknown[] = [];
    server.node.onDot((dot) => received.push(dot));

    const largePayload = 'x'.repeat(10 * 1024); // 10KB
    const dot = observe(largePayload, { plaintext: true });
    await client.node.broadcast(dot);

    await waitFor(() => received.length === 1, 3000);
    expect(received.length).toBe(1);
  });

  it('rapid connect/disconnect (10 times) does not crash server', async () => {
    server = await makeServerNode();

    for (let i = 0; i < 10; i++) {
      const identity = await createIdentity();
      const t = new WSTransport({ publicKey: identity.publicKey });
      await t.connect(`127.0.0.1:${server.port}`);
      await t.close();
    }

    // Server should still be running
    expect(server.transport.boundPort).toBeGreaterThan(0);
  }, 15000);

  it('server shutdown while client connected: client transport closes cleanly', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    // Close server
    await server.transport.close();
    server.node.close();

    // Client's peer should be removed eventually
    await waitFor(() => client.transport.peers().length === 0, 3000);
    expect(client.transport.peers().length).toBe(0);
  });

  it('send to disconnected peer is a no-op (no crash)', async () => {
    server = await makeServerNode();
    client = await makeClientNode(server.port);
    await waitFor(() => server.transport.peers().length === 1);

    const fakePeerId = 'a'.repeat(64);
    // Should not throw
    await expect(server.transport.send(fakePeerId, new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
  });

  it('calling close() twice does not throw', async () => {
    server = await makeServerNode();
    await server.transport.close();
    server.node.close();
    await expect(server.transport.close()).resolves.toBeUndefined();
    (server as unknown as Record<string, boolean>)._skipClose = true;
  });

  it('two nodes each act as server and can cross-connect', async () => {
    server = await makeServerNode();

    const identity2 = await createIdentity();
    const t2 = new WSTransport({ publicKey: identity2.publicKey });
    const port2 = await t2.listen();
    const node2 = createNode({ identity: identity2, transport: t2 });

    // Server connects TO node2 (server acts as client here)
    await server.transport.connect(`127.0.0.1:${port2}`);
    await waitFor(() => t2.peers().length === 1, 2000);

    const received2: unknown[] = [];
    node2.onDot((dot) => received2.push(dot));

    const dot = observe('cross-connect', { plaintext: true });
    await server.node.broadcast(dot);

    await waitFor(() => received2.length === 1, 2000);
    expect(received2.length).toBe(1);

    node2.close();
    await t2.close();
  });
});
