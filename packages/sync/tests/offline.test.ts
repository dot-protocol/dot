/**
 * OfflineQueue tests — offline-first DOT queuing.
 * Target: 15+ tests.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import { createChain, append, walk } from '@dot-protocol/chain';
import { OfflineQueue } from '../src/offline.js';
import { createSyncNetwork } from './helpers.js';
import type { SyncTestNetwork } from './helpers.js';

let net: SyncTestNetwork;

afterEach(() => {
  net?.cleanup();
});

// --- enqueue (offline) ---

describe('enqueue()', () => {
  it('enqueue works with no peers (offline)', async () => {
    net = await createSyncNetwork(1); // no peers
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    const dot = observe('offline-dot', { plaintext: true });
    expect(() => queue.enqueue(dot)).not.toThrow();
  });

  it('enqueue adds to pending count', async () => {
    net = await createSyncNetwork(1);
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    queue.enqueue(observe('a', { plaintext: true }));
    expect(queue.pending()).toBe(1);
  });

  it('multiple enqueues increase pending', async () => {
    net = await createSyncNetwork(1);
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    queue.enqueue(observe('a', { plaintext: true }));
    queue.enqueue(observe('b', { plaintext: true }));
    queue.enqueue(observe('c', { plaintext: true }));
    expect(queue.pending()).toBe(3);
  });

  it('enqueue appends to the underlying chain', async () => {
    net = await createSyncNetwork(1);
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    queue.enqueue(observe('x', { plaintext: true }));
    expect(queue.getChain().appendCount).toBe(1);
  });

  it('enqueued DOTs are visible in the chain', async () => {
    net = await createSyncNetwork(1);
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    queue.enqueue(observe('hello', { plaintext: true }));
    const all = walk(queue.getChain());
    expect(all.length).toBe(1);
  });
});

// --- pending() ---

describe('pending()', () => {
  it('returns 0 for a fresh queue', async () => {
    net = await createSyncNetwork(1);
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);
    expect(queue.pending()).toBe(0);
  });

  it('returns correct count after enqueue', async () => {
    net = await createSyncNetwork(1);
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    for (let i = 0; i < 5; i++) {
      queue.enqueue(observe(`item-${i}`, { plaintext: true }));
    }
    expect(queue.pending()).toBe(5);
  });
});

// --- isOnline() ---

describe('isOnline()', () => {
  it('returns false when node has no peers', async () => {
    net = await createSyncNetwork(1); // isolated node
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);
    expect(queue.isOnline(peer!.node)).toBe(false);
  });

  it('returns true when node has at least one peer', async () => {
    net = await createSyncNetwork(2); // two connected nodes
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);
    expect(queue.isOnline(peer!.node)).toBe(true);
  });
});

// --- flush() ---

describe('flush()', () => {
  it('flush with no peers returns flushed=0, failed=0', async () => {
    net = await createSyncNetwork(1); // isolated
    const [peer] = net.peers;
    const queue = new OfflineQueue(peer!.chain);

    queue.enqueue(observe('a', { plaintext: true }));
    const result = await queue.flush(peer!.node);

    expect(result.flushed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('flush sends all pending DOTs when peers available', async () => {
    net = await createSyncNetwork(2);
    const [a, b] = net.peers;
    const queue = new OfflineQueue(a!.chain);

    queue.enqueue(observe('x', { plaintext: true }));
    queue.enqueue(observe('y', { plaintext: true }));

    const result = await queue.flush(a!.node);
    expect(result.flushed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('after flush, pending() is 0', async () => {
    net = await createSyncNetwork(2);
    const [a] = net.peers;
    const queue = new OfflineQueue(a!.chain);

    queue.enqueue(observe('flush-me', { plaintext: true }));
    await queue.flush(a!.node);

    expect(queue.pending()).toBe(0);
  });

  it('flush does not re-send already-flushed DOTs', async () => {
    net = await createSyncNetwork(2);
    const [a] = net.peers;
    const queue = new OfflineQueue(a!.chain);

    queue.enqueue(observe('once', { plaintext: true }));
    const r1 = await queue.flush(a!.node);
    const r2 = await queue.flush(a!.node);

    expect(r1.flushed).toBe(1);
    expect(r2.flushed).toBe(0); // nothing left to send
  });

  it('flush result has duration_ms >= 0', async () => {
    net = await createSyncNetwork(1);
    const [a] = net.peers;
    const queue = new OfflineQueue(a!.chain);
    const result = await queue.flush(a!.node);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('multiple enqueue then single flush sends all', async () => {
    net = await createSyncNetwork(2);
    const [a, b] = net.peers;
    const queue = new OfflineQueue(a!.chain);

    for (let i = 0; i < 5; i++) {
      queue.enqueue(observe(`batch-${i}`, { plaintext: true }));
    }
    expect(queue.pending()).toBe(5);

    const result = await queue.flush(a!.node);
    expect(result.flushed).toBe(5);
    expect(queue.pending()).toBe(0);
  });
});

// --- getChain() ---

describe('getChain()', () => {
  it('returns initial chain when nothing enqueued', async () => {
    const chain = createChain();
    const queue = new OfflineQueue(chain);
    expect(queue.getChain().appendCount).toBe(0);
  });

  it('returns updated chain after enqueue', async () => {
    const chain = createChain();
    const queue = new OfflineQueue(chain);
    queue.enqueue(observe('test', { plaintext: true }));
    expect(queue.getChain().appendCount).toBe(1);
  });
});
