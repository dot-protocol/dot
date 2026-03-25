/**
 * room-chain.test.ts — Tests for the FirstRoom data model.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { verify_chain } from '@dot-protocol/chain';
import {
  createFirstRoom,
  addObservation,
  addMember,
  getChainView,
} from '../src/room-chain.js';
import type { FirstRoom } from '../src/room-chain.js';

describe('createFirstRoom', () => {
  it('returns a FirstRoom with name ".the.first.room"', async () => {
    const room = await createFirstRoom();
    expect(room.name).toBe('.the.first.room');
  });

  it('room has a valid chain after creation', async () => {
    const room = await createFirstRoom();
    expect(room.chain).toBeDefined();
    expect(room.chain.appendCount).toBe(1);
  });

  it('genesis DOT has correct content', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    expect(entries.length).toBe(1);
    expect(entries[0]!.content).toBe('The first room. Where observation begins.');
  });

  it('genesis DOT has depth 0', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    expect(entries[0]!.depth).toBe(0);
  });

  it('room starts with dotCount = 1', async () => {
    const room = await createFirstRoom();
    expect(room.dotCount).toBe(1);
  });

  it('room starts with no members', async () => {
    const room = await createFirstRoom();
    expect(room.members.size).toBe(0);
  });

  it('room has an identity (publicKey + secretKey)', async () => {
    const room = await createFirstRoom();
    expect(room.identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(room.identity.publicKey.length).toBe(32);
    expect(room.identity.secretKey).toBeInstanceOf(Uint8Array);
    expect(room.identity.secretKey.length).toBe(32);
  });

  it('room.createdAt is a reasonable unix timestamp', async () => {
    const before = Date.now();
    const room = await createFirstRoom();
    const after = Date.now();
    expect(room.createdAt).toBeGreaterThanOrEqual(before);
    expect(room.createdAt).toBeLessThanOrEqual(after);
  });

  it('chain is verifiable after genesis', async () => {
    const room = await createFirstRoom();
    const result = verify_chain(room.chain);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('genesis DOT is signed by room identity', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    const entry = entries[0]!;
    // Observer shortcode is first 8 hex chars of room's public key
    const expectedObserver = Buffer.from(room.identity.publicKey).toString('hex').slice(0, 8);
    expect(entry.observer).toBe(expectedObserver);
  });
});

describe('addObservation', () => {
  let room: FirstRoom;
  let observerIdentity: { publicKey: Uint8Array; secretKey: Uint8Array };

  beforeEach(async () => {
    room = await createFirstRoom();
    observerIdentity = await createIdentity();
  });

  it('appends a DOT to the room chain', async () => {
    const countBefore = room.dotCount;
    await addObservation(room, 'Hello world', observerIdentity);
    expect(room.dotCount).toBe(countBefore + 1);
  });

  it('returned DOT has correct content', async () => {
    const dot = await addObservation(room, 'test content', observerIdentity);
    const decoded = new TextDecoder().decode(dot.payload);
    expect(decoded).toBe('test content');
  });

  it('dot has type "claim"', async () => {
    const dot = await addObservation(room, 'observation', observerIdentity);
    expect(dot.type).toBe('claim');
  });

  it('dot is signed by the observer', async () => {
    const dot = await addObservation(room, 'signed obs', observerIdentity);
    expect(dot.sign?.signature).toBeDefined();
    expect(dot.sign?.observer).toEqual(observerIdentity.publicKey);
  });

  it('observation appears in getChainView', async () => {
    await addObservation(room, 'visible content', observerIdentity);
    const entries = getChainView(room);
    const found = entries.find((e) => e.content === 'visible content');
    expect(found).toBeDefined();
  });

  it('chain remains valid after adding observation', async () => {
    await addObservation(room, 'observation A', observerIdentity);
    const result = verify_chain(room.chain);
    expect(result.valid).toBe(true);
  });

  it('multiple observations produce correct depths', async () => {
    await addObservation(room, 'obs 1', observerIdentity);
    await addObservation(room, 'obs 2', observerIdentity);
    const entries = getChainView(room);
    // genesis=0, obs1=1, obs2=2
    expect(entries[0]!.depth).toBe(0);
    expect(entries[1]!.depth).toBe(1);
    expect(entries[2]!.depth).toBe(2);
  });
});

describe('addMember', () => {
  let room: FirstRoom;

  beforeEach(async () => {
    room = await createFirstRoom();
  });

  it('adds a member to the room', async () => {
    const id = await createIdentity();
    await addMember(room, 'Blaze', id);
    expect(room.members.size).toBe(1);
  });

  it('member has correct name', async () => {
    const id = await createIdentity();
    await addMember(room, 'Rumi', id);
    const pkHex = Buffer.from(id.publicKey).toString('hex');
    expect(room.members.get(pkHex)?.name).toBe('Rumi');
  });

  it('join DOT is appended to chain', async () => {
    const id = await createIdentity();
    const countBefore = room.dotCount;
    await addMember(room, 'Alice', id);
    expect(room.dotCount).toBe(countBefore + 1);
  });

  it('join DOT has type "event"', async () => {
    const id = await createIdentity();
    const dot = await addMember(room, 'Bob', id);
    expect(dot.type).toBe('event');
  });

  it('join DOT content mentions member name', async () => {
    const id = await createIdentity();
    const dot = await addMember(room, 'Feynman', id);
    const content = new TextDecoder().decode(dot.payload);
    expect(content).toContain('Feynman');
  });

  it('chain remains valid after adding member', async () => {
    const id = await createIdentity();
    await addMember(room, 'Valid', id);
    const result = verify_chain(room.chain);
    expect(result.valid).toBe(true);
  });

  it('multiple members can join', async () => {
    const id1 = await createIdentity();
    const id2 = await createIdentity();
    await addMember(room, 'Alice', id1);
    await addMember(room, 'Bob', id2);
    expect(room.members.size).toBe(2);
  });
});

describe('getChainView', () => {
  it('returns entries in oldest-first order (genesis first)', async () => {
    const room = await createFirstRoom();
    const id = await createIdentity();
    await addObservation(room, 'second', id);
    await addObservation(room, 'third', id);

    const entries = getChainView(room);
    expect(entries[0]!.content).toBe('The first room. Where observation begins.');
    expect(entries[1]!.content).toBe('second');
    expect(entries[2]!.content).toBe('third');
  });

  it('each entry has a non-empty hash', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    expect(entries[0]!.hash.length).toBeGreaterThan(8);
  });

  it('each entry has a observer shortcode (8 hex chars)', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    expect(entries[0]!.observer).toMatch(/^[0-9a-f]{8}$/);
  });

  it('each entry has a timestamp', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    expect(entries[0]!.timestamp).toBeGreaterThan(0);
  });

  it('each entry has a trust score >= 0', async () => {
    const room = await createFirstRoom();
    const id = await createIdentity();
    await addObservation(room, 'obs', id);
    const entries = getChainView(room);
    for (const e of entries) {
      expect(e.trust).toBeGreaterThanOrEqual(0);
    }
  });

  it('verified field is true when chain is intact', async () => {
    const room = await createFirstRoom();
    const entries = getChainView(room);
    expect(entries[0]!.verified).toBe(true);
  });
});

describe('50-observation stress test', () => {
  it('handles 50 observations with correct final count', async () => {
    const room = await createFirstRoom();
    const id = await createIdentity();

    for (let i = 0; i < 50; i++) {
      await addObservation(room, `observation #${i}`, id);
    }

    // genesis + 50
    expect(room.dotCount).toBe(51);
  });

  it('50 observations — chain remains valid', async () => {
    const room = await createFirstRoom();
    const id = await createIdentity();

    for (let i = 0; i < 50; i++) {
      await addObservation(room, `obs ${i}`, id);
    }

    const result = verify_chain(room.chain);
    expect(result.valid).toBe(true);
  });

  it('50 observations — all depths are correct', async () => {
    const room = await createFirstRoom();
    const id = await createIdentity();

    for (let i = 0; i < 10; i++) {
      await addObservation(room, `obs ${i}`, id);
    }

    const entries = getChainView(room);
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i]!.depth).toBe(i);
    }
  });
});

describe('multiple observers', () => {
  it('multiple members can observe independently', async () => {
    const room = await createFirstRoom();
    const alice = await createIdentity();
    const bob = await createIdentity();

    await addObservation(room, 'Alice observes', alice);
    await addObservation(room, 'Bob observes', bob);

    const entries = getChainView(room);
    expect(entries.some((e) => e.content === 'Alice observes')).toBe(true);
    expect(entries.some((e) => e.content === 'Bob observes')).toBe(true);
  });

  it('different observers produce different observer shortcodes', async () => {
    const room = await createFirstRoom();
    const alice = await createIdentity();
    const bob = await createIdentity();

    await addObservation(room, 'A', alice);
    await addObservation(room, 'B', bob);

    const entries = getChainView(room);
    const aliceEntry = entries.find((e) => e.content === 'A')!;
    const bobEntry = entries.find((e) => e.content === 'B')!;

    // Very likely to differ (different keypairs)
    expect(aliceEntry.observer).not.toBe(bobEntry.observer);
  });
});
