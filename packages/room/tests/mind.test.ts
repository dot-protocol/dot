/**
 * mind.test.ts — Mind management tests.
 * Target: 20+ tests.
 */

import { describe, it, expect } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { walk } from '@dot-protocol/chain';
import { createRoom } from '../src/room.js';
import { createMind, activateMind, deactivateMind, mindRespond } from '../src/mind.js';
import type { Mind } from '../src/types.js';

// --- createMind ---

describe('createMind', () => {
  it('creates a mind with correct id', async () => {
    const mind = await createMind('feynman', 'Feynman', 'physics');
    expect(mind.id).toBe('feynman');
  });

  it('creates a mind with correct name', async () => {
    const mind = await createMind('feynman', 'Feynman', 'physics');
    expect(mind.name).toBe('Feynman');
  });

  it('creates a mind with correct domain', async () => {
    const mind = await createMind('feynman', 'Feynman', 'physics');
    expect(mind.domain).toBe('physics');
  });

  it('creates mind with a 32-byte publicKey', async () => {
    const mind = await createMind('feynman', 'Feynman', 'physics');
    expect(mind.publicKey.length).toBe(32);
  });

  it('mind is inactive by default', async () => {
    const mind = await createMind('feynman', 'Feynman', 'physics');
    expect(mind.active).toBe(false);
  });

  it('two minds have different publicKeys', async () => {
    const m1 = await createMind('feynman', 'Feynman', 'physics');
    const m2 = await createMind('rumi', 'Rumi', 'poetry');
    expect(m1.publicKey).not.toEqual(m2.publicKey);
  });
});

// --- activateMind ---

describe('activateMind', () => {
  it('adds mind to room.minds', async () => {
    const room = await createRoom('.test');
    const mind = await createMind('feynman', 'Feynman', 'physics');
    await activateMind(room, mind);
    expect(room.minds.has('feynman')).toBe(true);
  });

  it('mind is marked active after activation', async () => {
    const room = await createRoom('.test');
    const mind = await createMind('feynman', 'Feynman', 'physics');
    await activateMind(room, mind);
    expect(room.minds.get('feynman')?.active).toBe(true);
  });

  it('adds a DOT to the chain', async () => {
    const room = await createRoom('.test');
    const countBefore = room.chain.appendCount;
    const mind = await createMind('feynman', 'Feynman', 'physics');
    await activateMind(room, mind);
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns a signed DOT', async () => {
    const room = await createRoom('.test');
    const mind = await createMind('feynman', 'Feynman', 'physics');
    const dot = await activateMind(room, mind);
    expect(dot.sign?.observer).toBeDefined();
    expect(dot.sign?.signature).toBeDefined();
  });

  it('multiple minds can be activated in one room', async () => {
    const room = await createRoom('.test');
    const feynman = await createMind('feynman', 'Feynman', 'physics');
    const rumi = await createMind('rumi', 'Rumi', 'poetry');
    await activateMind(room, feynman);
    await activateMind(room, rumi);
    expect(room.minds.size).toBe(2);
  });

  it('activate DOT payload contains mind domain', async () => {
    const room = await createRoom('.test');
    const mind = await createMind('feynman', 'Feynman', 'physics');
    const dot = await activateMind(room, mind);
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(obj.domain).toBe('physics');
  });
});

// --- deactivateMind ---

describe('deactivateMind', () => {
  it('marks mind as inactive', async () => {
    const room = await createRoom('.test');
    const mind = await createMind('feynman', 'Feynman', 'physics');
    await activateMind(room, mind);
    await deactivateMind(room, 'feynman');
    expect(room.minds.get('feynman')?.active).toBe(false);
  });

  it('adds a deactivate DOT to the chain', async () => {
    const room = await createRoom('.test');
    const mind = await createMind('feynman', 'Feynman', 'physics');
    await activateMind(room, mind);
    const countBefore = room.chain.appendCount;
    await deactivateMind(room, 'feynman');
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('no-ops gracefully when mind not found', async () => {
    const room = await createRoom('.test');
    // Should not throw
    await expect(deactivateMind(room, 'nonexistent')).resolves.toBeUndefined();
  });
});

// --- mindRespond ---

describe('mindRespond', () => {
  it('creates a response DOT signed with the mind key', async () => {
    const room = await createRoom('.test');
    const alice = await createIdentity();
    const { observe_in_room } = await import('../src/room.js');
    const query = await observe_in_room(room, 'What is quantum entanglement?', alice);

    const mind = await createMind('feynman', 'Feynman', 'physics') as Mind & { _secretKey: Uint8Array };
    await activateMind(room, mind);

    const response = await mindRespond(room, mind, query, 'Quantum entanglement is...');
    expect(response.sign?.observer).toBeDefined();
    expect(response.sign?.signature).toBeDefined();
  });

  it('response DOT payload contains response text', async () => {
    const room = await createRoom('.test');
    const alice = await createIdentity();
    const { observe_in_room } = await import('../src/room.js');
    const query = await observe_in_room(room, 'What is entropy?', alice);

    const mind = await createMind('feynman', 'Feynman', 'physics') as Mind & { _secretKey: Uint8Array };
    await activateMind(room, mind);

    const dot = await mindRespond(room, mind, query, 'Entropy measures disorder');
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(obj.response).toBe('Entropy measures disorder');
  });

  it('response DOT includes queryHash', async () => {
    const room = await createRoom('.test');
    const alice = await createIdentity();
    const { observe_in_room } = await import('../src/room.js');
    const query = await observe_in_room(room, 'What is a quark?', alice);

    const mind = await createMind('feynman', 'Feynman', 'physics') as Mind & { _secretKey: Uint8Array };
    await activateMind(room, mind);

    const dot = await mindRespond(room, mind, query, 'A quark is...');
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(typeof obj.queryHash).toBe('string');
    expect(obj.queryHash.length).toBe(64); // 32-byte BLAKE3 as hex
  });

  it('response DOT includes citations when provided', async () => {
    const room = await createRoom('.test');
    const alice = await createIdentity();
    const { observe_in_room } = await import('../src/room.js');
    const query = await observe_in_room(room, 'Explain relativity', alice);

    const mind = await createMind('feynman', 'Feynman', 'physics') as Mind & { _secretKey: Uint8Array };
    await activateMind(room, mind);

    const dot = await mindRespond(room, mind, query, 'Relativity says...', ['Einstein 1905', 'Minkowski 1908']);
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(obj.citations).toEqual(['Einstein 1905', 'Minkowski 1908']);
  });

  it('response DOT is appended to chain', async () => {
    const room = await createRoom('.test');
    const alice = await createIdentity();
    const { observe_in_room } = await import('../src/room.js');
    const query = await observe_in_room(room, 'Test query', alice);

    const mind = await createMind('feynman', 'Feynman', 'physics') as Mind & { _secretKey: Uint8Array };
    await activateMind(room, mind);

    const countBefore = room.chain.appendCount;
    await mindRespond(room, mind, query, 'Response text');
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('response DOT is signed with mind key (not room key)', async () => {
    const room = await createRoom('.test');
    const alice = await createIdentity();
    const { observe_in_room } = await import('../src/room.js');
    const query = await observe_in_room(room, 'Test', alice);

    const mind = await createMind('feynman', 'Feynman', 'physics') as Mind & { _secretKey: Uint8Array };
    await activateMind(room, mind);

    const dot = await mindRespond(room, mind, query, 'Answer');
    // Observer should be the mind's public key, not the room's
    const observerHex = Buffer.from(dot.sign!.observer!).toString('hex');
    const roomPubHex = Buffer.from(room.identity.publicKey).toString('hex');
    expect(observerHex).not.toBe(roomPubHex);
  });
});
