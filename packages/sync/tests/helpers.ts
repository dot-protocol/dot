/**
 * Test helpers for @dot-protocol/sync.
 */

import { createIdentity } from '@dot-protocol/core';
import { createChain } from '@dot-protocol/chain';
import { createNode, MemoryHub, MemoryTransport } from '@dot-protocol/mesh';
import type { MeshNode } from '@dot-protocol/mesh';
import type { Chain } from '@dot-protocol/chain';

export interface SyncTestPeer {
  node: MeshNode;
  chain: Chain;
  transport: MemoryTransport;
}

export interface SyncTestNetwork {
  peers: SyncTestPeer[];
  hub: MemoryHub;
  cleanup: () => void;
}

/**
 * Create N peers connected via a shared MemoryHub, each with a fresh Chain.
 */
export async function createSyncNetwork(n: number): Promise<SyncTestNetwork> {
  const hub = new MemoryHub();
  const peers: SyncTestPeer[] = [];

  for (let i = 0; i < n; i++) {
    const identity = await createIdentity();
    const nodeId = Buffer.from(identity.publicKey).toString('hex');
    const transport = new MemoryTransport(hub, nodeId);
    const node = createNode({ identity, transport });
    const chain = createChain();
    peers.push({ node, chain, transport });
  }

  // Fully connect all peers
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const target = peers[j];
      if (target !== undefined) {
        await peers[i]?.transport.connect(target.node.id);
      }
    }
  }

  // Exchange ping DOTs so that node.peers tables get populated
  if (n > 1) {
    const { observe } = await import('@dot-protocol/core');
    const pingDot = observe('ping', { plaintext: true });
    for (const peer of peers) {
      await peer.node.broadcast(pingDot);
    }
    // Small yield to let message handlers fire
    await new Promise<void>((r) => setTimeout(r, 5));
  }

  return {
    peers,
    hub,
    cleanup() {
      for (const peer of peers) {
        peer.node.close();
        peer.transport.close();
      }
    },
  };
}

/**
 * Wait for a condition to become true, polling every pollMs.
 * Rejects after timeoutMs.
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 1000,
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
