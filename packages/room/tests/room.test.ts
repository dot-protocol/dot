/**
 * room.test.ts — Core room operation tests.
 * Target: 35+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity, verify } from '@dot-protocol/core';
import { walk, verify_chain } from '@dot-protocol/chain';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  observe_in_room,
  correct,
  getState,
  replayRoom,
  getRoomDots,
  getRoomTipHash,
} from '../src/room.js';

// --- createRoom ---

describe('createRoom', () => {
  it('creates a room with a valid name', async () => {
    const room = await createRoom('.physics');
    expect(room.name).toBe('.physics');
  });

  it('normalizes the room name to lowercase', async () => {
    const room = await createRoom('.PHYSICS');
    expect(room.name).toBe('.physics');
  });

  it('produces a genesis DOT in the chain', async () => {
    const room = await createRoom('.physics');
    expect(room.chain.appendCount).toBeGreaterThan(0);
    expect(room.chain.tipHash).not.toBeNull();
  });

  it('genesis DOT has non-null tipHash', async () => {
    const room = await createRoom('.physics');
    expect(room.chain.tipHash).toBeTruthy();
  });

  it('starts with zero members when no creator provided', async () => {
    const room = await createRoom('.physics');
    expect(room.members.size).toBe(0);
  });

  it('has a valid room identity with publicKey and secretKey', async () => {
    const room = await createRoom('.physics');
    expect(room.identity.publicKey.length).toBe(32);
    expect(room.identity.secretKey.length).toBe(32);
  });

  it('identity name matches room name', async () => {
    const room = await createRoom('.the.first.room');
    expect(room.identity.name).toBe('.the.first.room');
  });

  it('state.dotCount reflects genesis DOT', async () => {
    const room = await createRoom('.physics');
    expect(room.state.dotCount).toBeGreaterThan(0);
  });

  it('adds creator as member when identity provided', async () => {
    const creator = await createIdentity();
    const room = await createRoom('.physics', creator);
    expect(room.members.size).toBe(1);
  });

  it('creator join adds an extra DOT to chain', async () => {
    const creator = await createIdentity();
    const room = await createRoom('.physics', creator);
    // genesis + join = at least 2 DOTs
    expect(room.chain.appendCount).toBeGreaterThanOrEqual(2);
  });

  it('accepts custom config visibility', async () => {
    const room = await createRoom('.physics', undefined, { visibility: 'private' });
    expect(room.config.visibility).toBe('private');
  });

  it('default visibility is "public"', async () => {
    const room = await createRoom('.physics');
    expect(room.config.visibility).toBe('public');
  });

  it('throws for invalid room name', async () => {
    await expect(createRoom('noDot')).rejects.toThrow();
  });
});

// --- joinRoom ---

describe('joinRoom', () => {
  it('adds a member to the room', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    expect(room.members.size).toBe(1);
  });

  it('creates a join DOT in the chain', async () => {
    const room = await createRoom('.physics');
    const countBefore = room.chain.appendCount;
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('member has correct name', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const member = await joinRoom(room, alice, 'Alice');
    expect(member.name).toBe('Alice');
  });

  it('member role defaults to "contributor"', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const member = await joinRoom(room, alice);
    expect(member.role).toBe('contributor');
  });

  it('member joinedAt is a recent timestamp', async () => {
    const before = Date.now();
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const member = await joinRoom(room, alice);
    const after = Date.now();
    expect(member.joinedAt).toBeGreaterThanOrEqual(before);
    expect(member.joinedAt).toBeLessThanOrEqual(after);
  });

  it('multiple members can join', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const bob = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    await joinRoom(room, bob, 'Bob');
    expect(room.members.size).toBe(2);
  });

  it('state updates after join', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    expect(room.state.memberCount).toBe(1);
  });
});

// --- leaveRoom ---

describe('leaveRoom', () => {
  it('removes member from members map', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    expect(room.members.size).toBe(1);
    await leaveRoom(room, alice.publicKey, alice.secretKey);
    expect(room.members.size).toBe(0);
  });

  it('adds a leave DOT to the chain', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice);
    const countBefore = room.chain.appendCount;
    await leaveRoom(room, alice.publicKey, alice.secretKey);
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('handles leaving a non-member gracefully', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    // Should not throw
    await expect(leaveRoom(room, alice.publicKey, alice.secretKey)).resolves.toBeUndefined();
  });
});

// --- observe_in_room ---

describe('observe_in_room', () => {
  it('adds a DOT to the chain', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    const countBefore = room.chain.appendCount;
    await observe_in_room(room, 'Hello room!', alice);
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns a signed DOT', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const dot = await observe_in_room(room, 'test', alice);
    expect(dot.sign?.observer).toBeDefined();
    expect(dot.sign?.signature).toBeDefined();
  });

  it('includes citations in payload', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const dot = await observe_in_room(room, 'test', alice, { citations: ['src1', 'src2'] });
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(obj.citations).toEqual(['src1', 'src2']);
  });

  it('includes parentHash when provided', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const dot = await observe_in_room(room, 'test', alice, { parentHash: 'abc123' });
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(obj.parentHash).toBe('abc123');
  });

  it('multiple observers posting — all DOTs in chain', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const bob = await createIdentity();
    await observe_in_room(room, 'Hello from Alice', alice);
    await observe_in_room(room, 'Hello from Bob', bob);
    await observe_in_room(room, 'Reply from Alice', alice);
    // At least genesis + 3 observations
    expect(room.chain.appendCount).toBeGreaterThanOrEqual(4);
  });
});

// --- correct ---

describe('correct', () => {
  it('creates a correction DOT referencing the original', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const original = await observe_in_room(room, 'The sky is green', alice);
    const originalHash = room.chain.tipHash!;
    const correctionDot = await correct(room, originalHash, 'The sky is blue', alice);
    const text = new TextDecoder().decode(correctionDot.payload);
    const obj = JSON.parse(text);
    expect(obj.parentHash).toBe(originalHash);
    expect(obj.content).toBe('The sky is blue');
  });

  it('adds a DOT to the chain', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await observe_in_room(room, 'wrong', alice);
    const hash = room.chain.tipHash!;
    const countBefore = room.chain.appendCount;
    await correct(room, hash, 'corrected', alice);
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });
});

// --- getState ---

describe('getState', () => {
  it('returns accurate dotCount', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice);
    await observe_in_room(room, 'hello', alice);
    const state = await getState(room);
    expect(state.dotCount).toBe(room.chain.appendCount);
  });

  it('returns accurate memberCount', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const bob = await createIdentity();
    await joinRoom(room, alice);
    await joinRoom(room, bob);
    const state = await getState(room);
    expect(state.memberCount).toBe(2);
  });

  it('stateHash is a non-empty Uint8Array', async () => {
    const room = await createRoom('.physics');
    const state = await getState(room);
    expect(state.stateHash).toBeInstanceOf(Uint8Array);
    expect(state.stateHash.length).toBeGreaterThan(0);
  });

  it('state after 100 observations has dotCount >= 101', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    for (let i = 0; i < 100; i++) {
      await observe_in_room(room, `Observation ${i}`, alice);
    }
    const state = await getState(room);
    // 1 genesis + 100 observations = 101
    expect(state.dotCount).toBeGreaterThanOrEqual(101);
  });
});

// --- replayRoom ---

describe('replayRoom', () => {
  it('reconstructs a room from its chain alone', async () => {
    const creator = await createIdentity();
    const original = await createRoom('.physics', creator);
    await observe_in_room(original, 'hello', creator);

    // Take just the chain
    const chain = original.chain;
    const replayed = await replayRoom(chain);

    expect(replayed.chain.appendCount).toBe(original.chain.appendCount);
  });

  it('replayed room has correct dotCount', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    await observe_in_room(room, 'hello', alice);

    const replayed = await replayRoom(room.chain);
    expect(replayed.state.dotCount).toBe(room.chain.appendCount);
  });

  it('replayed room recovers member from join DOT', async () => {
    const creator = await createIdentity();
    const room = await createRoom('.physics', creator);

    const replayed = await replayRoom(room.chain);
    // Genesis-created rooms with creator have join DOT
    expect(replayed.members.size).toBeGreaterThanOrEqual(1);
  });

  it('replayed room chain is independently walkable', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await observe_in_room(room, 'test', alice);

    const replayed = await replayRoom(room.chain);
    const dots = walk(replayed.chain);
    expect(dots.length).toBe(room.chain.appendCount);
  });
});

// --- chain verifiability ---

describe('chain integrity', () => {
  it('chain is valid after room operations', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');
    await observe_in_room(room, 'observation 1', alice);
    await observe_in_room(room, 'observation 2', alice);

    const result = verify_chain(room.chain);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('tipHash changes after each append', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    const tip1 = room.chain.tipHash;
    await observe_in_room(room, 'hello', alice);
    const tip2 = room.chain.tipHash;
    expect(tip1).not.toBe(tip2);
  });

  it('getRoomDots returns all DOTs in order', async () => {
    const room = await createRoom('.physics');
    const alice = await createIdentity();
    await observe_in_room(room, 'first', alice);
    await observe_in_room(room, 'second', alice);
    const dots = getRoomDots(room);
    expect(dots.length).toBe(room.chain.appendCount);
  });

  it('getRoomTipHash returns current tip', async () => {
    const room = await createRoom('.physics');
    expect(getRoomTipHash(room)).toBe(room.chain.tipHash);
  });
});
