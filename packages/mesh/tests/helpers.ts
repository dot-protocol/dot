/**
 * Test helpers for @dot-protocol/mesh.
 *
 * createTestMesh(n) — spin up N nodes all connected via a shared MemoryHub.
 * All nodes are fully connected (each peer knows every other peer).
 */

import { createIdentity } from '@dot-protocol/core';
import type { Identity } from '@dot-protocol/core';
import { MemoryHub, MemoryTransport } from '../src/transport/memory.js';
import { createNode } from '../src/node.js';
import type { MeshNode } from '../src/node.js';

export interface TestMesh {
  nodes: MeshNode[];
  hub: MemoryHub;
  transports: MemoryTransport[];
  identities: Identity[];
  /** Disconnect all nodes and clean up transport registrations. */
  cleanup: () => void;
}

/**
 * Create N test nodes all connected to each other via a shared MemoryHub.
 *
 * Each node can send messages to every other node. All nodes start with
 * a fresh MemoryStorage and a unique Ed25519 identity.
 *
 * @param nodeCount - Number of nodes to create (minimum 1).
 * @returns A TestMesh with nodes, hub, and cleanup function.
 */
export async function createTestMesh(nodeCount: number): Promise<TestMesh> {
  const hub = new MemoryHub();
  const identities: Identity[] = [];
  const transports: MemoryTransport[] = [];
  const nodes: MeshNode[] = [];

  // Create identities and transports first
  for (let i = 0; i < nodeCount; i++) {
    const identity = await createIdentity();
    const nodeId = Buffer.from(identity.publicKey).toString('hex');
    const transport = new MemoryTransport(hub, nodeId);
    identities.push(identity);
    transports.push(transport);
  }

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    const identity = identities[i];
    const transport = transports[i];
    if (identity === undefined || transport === undefined) {
      throw new Error(`Missing identity or transport at index ${i}`);
    }
    const node = createNode({ identity, transport });
    nodes.push(node);
  }

  // Fully connect all nodes: each node connects to every other node
  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      if (i === j) continue;
      const nodeId = nodes[j]?.id;
      if (nodeId !== undefined) {
        await transports[i]?.connect(nodeId);
      }
    }
  }

  function cleanup(): void {
    for (let i = 0; i < nodeCount; i++) {
      nodes[i]?.close();
      transports[i]?.close();
    }
  }

  return { nodes, hub, transports, identities, cleanup };
}

/**
 * Wait for a condition to become true, polling every `pollMs`.
 * Rejects after `timeoutMs` if condition never becomes true.
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 500,
  pollMs = 10,
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise<void>((r) => setTimeout(r, pollMs));
  }
}
