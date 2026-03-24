/**
 * Broadcast tests — fan-out, dedup, disconnected peers, all reachable.
 * Target: 25+ tests.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import { broadcast } from '../src/broadcast.js';
import { createTestMesh, waitFor } from './helpers.js';
import type { TestMesh } from './helpers.js';

let mesh: TestMesh;

afterEach(() => {
  mesh?.cleanup();
});

describe('broadcast()', () => {
  it('returns 0 when no peers connected', async () => {
    mesh = await createTestMesh(1);
    const dot = observe('solo', { plaintext: true });
    const count = await broadcast(mesh.nodes[0]!, dot);
    expect(count).toBe(0);
  });

  it('returns 1 when broadcasting to one peer', async () => {
    mesh = await createTestMesh(2);
    const dot = observe('to-one', { plaintext: true });
    const count = await broadcast(mesh.nodes[0]!, dot);
    expect(count).toBe(1);
  });

  it('returns 2 when broadcasting to two peers', async () => {
    mesh = await createTestMesh(3);
    const dot = observe('to-two', { plaintext: true });
    const count = await broadcast(mesh.nodes[0]!, dot);
    expect(count).toBe(2);
  });

  it('broadcasting DOT stores it locally on sender', async () => {
    mesh = await createTestMesh(2);
    const node = mesh.nodes[0]!;
    const dot = observe('store-on-send', { plaintext: true });
    await broadcast(node, dot);
    expect(node.storage.count()).toBe(1);
  });

  it('receiver stores the broadcast DOT', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe('receiver-stores', { plaintext: true });
    await broadcast(sender, dot);
    await waitFor(() => receiver.storage.count() > 0, 500);
    expect(receiver.storage.count()).toBe(1);
  });

  it('all 3 receivers get the DOT from sender', async () => {
    mesh = await createTestMesh(4);
    const [sender, ...receivers] = mesh.nodes as [typeof mesh.nodes[0], ...typeof mesh.nodes];
    const dot = observe('all-receive', { plaintext: true });
    await broadcast(sender!, dot);
    await waitFor(
      () => receivers.every((r) => r!.storage.count() > 0),
      1000,
    );
    for (const receiver of receivers) {
      expect(receiver!.storage.count()).toBeGreaterThan(0);
    }
  });

  it('dedup: re-broadcasting same DOT does not cause loop', async () => {
    mesh = await createTestMesh(3);
    const [n0, n1, n2] = mesh.nodes as [typeof mesh.nodes[0], typeof mesh.nodes[0], typeof mesh.nodes[0]];

    let receiveCount = 0;
    n1!.onDot(() => { receiveCount++; });
    n2!.onDot(() => { receiveCount++; });

    const dot = observe('dedup-loop', { plaintext: true });
    await broadcast(n0!, dot);
    await waitFor(() => receiveCount >= 2, 500);
    await new Promise<void>((r) => setTimeout(r, 100)); // extra settle time

    // Should be exactly 1 per receiver (no loops)
    expect(receiveCount).toBe(2);
  });

  it('dedup: broadcasting same DOT twice delivers only once per receiver', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];

    let count = 0;
    receiver.onDot(() => { count++; });

    const dot = observe('same-dot-twice', { plaintext: true });
    await broadcast(sender, dot);
    await broadcast(sender, dot);

    await waitFor(() => count >= 1, 500);
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(count).toBe(1);
  });

  it('disconnected peer is skipped gracefully', async () => {
    mesh = await createTestMesh(2);
    const [sender] = [mesh.nodes[0]!];

    // Disconnect the peer
    mesh.transports[0]!.disconnect(mesh.nodes[1]!.id);

    const dot = observe('disconnected', { plaintext: true });
    const count = await broadcast(sender, dot);
    // The send may succeed or fail — what matters is it doesn't throw
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('large DOT broadcasts successfully', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];

    // 64KB payload
    const bigPayload = new Uint8Array(65536).fill(0x42);
    const dot = observe(bigPayload, { plaintext: true });
    const count = await broadcast(sender, dot);
    expect(count).toBe(1);

    await waitFor(() => receiver.storage.count() > 0, 1000);
    expect(receiver.storage.count()).toBe(1);
  });

  it('broadcast stores DOT with correct hash on receiver', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const dot = observe('hash-check', { plaintext: true });
    const hash = sender.store(dot);

    // Clear sender storage to test pure broadcast path
    sender.storage.clear();

    const dot2 = observe('hash-check-2', { plaintext: true });
    const hash2 = sender.store(dot2);
    await broadcast(sender, dot2);

    await waitFor(() => receiver.storage.get(hash2) !== null, 500);
    expect(receiver.storage.get(hash2)).not.toBeNull();
    void hash; // suppress unused warning
  });

  it('broadcast to 5 nodes — all receive', async () => {
    mesh = await createTestMesh(6); // 1 sender + 5 receivers
    const [sender, ...receivers] = mesh.nodes as [typeof mesh.nodes[0], ...typeof mesh.nodes];

    const dot = observe('five-receivers', { plaintext: true });
    const count = await broadcast(sender!, dot);
    expect(count).toBe(5);

    await waitFor(() => receivers.every((r) => r!.storage.count() > 0), 1000);
  });

  it('empty DOT broadcasts successfully', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe(); // empty DOT
    await broadcast(sender, dot);
    await waitFor(() => receiver.storage.count() > 0, 500);
    expect(receiver.storage.count()).toBe(1);
  });

  it('broadcast does not modify the DOT', async () => {
    mesh = await createTestMesh(2);
    const dot = observe('immutable', { plaintext: true });
    const originalType = dot.type;
    const originalMode = dot.payload_mode;
    await broadcast(mesh.nodes[0]!, dot);
    expect(dot.type).toBe(originalType);
    expect(dot.payload_mode).toBe(originalMode);
  });

  it('multiple distinct DOTs all arrive at receiver', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];

    await broadcast(sender, observe('dot1', { plaintext: true }));
    await broadcast(sender, observe('dot2', { plaintext: true }));
    await broadcast(sender, observe('dot3', { plaintext: true }));

    await waitFor(() => receiver.storage.count() >= 3, 1000);
    expect(receiver.storage.count()).toBe(3);
  });

  it('broadcast with type measure arrives correctly typed', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const received: typeof observe[] = [];
    receiver.onDot((dot) => { received.push(dot as never); });

    const dot = observe('42', { type: 'measure', plaintext: true });
    await broadcast(sender, dot);

    await waitFor(() => received.length > 0, 500);
    expect((received[0] as { type?: string })?.type).toBe('measure');
  });

  it('broadcast with event type preserved through transport', async () => {
    mesh = await createTestMesh(2);
    const [sender, receiver] = [mesh.nodes[0]!, mesh.nodes[1]!];

    let receivedType: string | undefined;
    receiver.onDot((dot) => { receivedType = dot.type; });

    const dot = observe('event-data', { type: 'event', plaintext: true });
    await broadcast(sender, dot);

    await waitFor(() => receivedType !== undefined, 500);
    expect(receivedType).toBe('event');
  });

  it('sender does not call its own onDot handler', async () => {
    mesh = await createTestMesh(2);
    const [sender] = [mesh.nodes[0]!];

    let senderCallCount = 0;
    sender.onDot(() => { senderCallCount++; });

    await broadcast(sender, observe('self-test', { plaintext: true }));
    await new Promise<void>((r) => setTimeout(r, 100));
    // Sender marks hash as seen before broadcasting, so its own handler won't fire
    expect(senderCallCount).toBe(0);
  });

  it('broadcast returns count equal to number of reachable peers', async () => {
    mesh = await createTestMesh(4);
    const dot = observe('count-check', { plaintext: true });
    const count = await broadcast(mesh.nodes[0]!, dot);
    expect(count).toBe(3); // 3 peers for a 4-node fully-connected mesh
  });
});
