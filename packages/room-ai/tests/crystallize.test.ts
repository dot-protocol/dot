/**
 * crystallize.test.ts — State crystallization DOT tests.
 * Target: 10+ tests.
 */

import { describe, it, expect } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { createRoom, activateMind, createMind as createRoomMind, joinRoom } from '@dot-protocol/room';
import { createFeynman, createRumi } from '@dot-protocol/minds';
import { RoomAI } from '../src/room-ai.js';
import { crystallize } from '../src/crystallize.js';
import type { CrystallizePayload } from '../src/crystallize.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeRoomAI() {
  const room = await createRoom('.crystallize-test');
  const feynman = await createFeynman();
  const rumi = await createRumi();

  // Register minds in the room
  const roomMindFeynman = await createRoomMind('feynman', 'Feynman', 'physics');
  const roomMindRumi = await createRoomMind('rumi', 'Rumi', 'poetry');
  await activateMind(room, roomMindFeynman);
  await activateMind(room, roomMindRumi);

  const ai = new RoomAI(room, [feynman, rumi]);
  return { room, ai };
}

function decodePayload(dot: { payload?: Uint8Array }): CrystallizePayload {
  const text = new TextDecoder().decode(dot.payload);
  return JSON.parse(text) as CrystallizePayload;
}

// ─── crystallize ──────────────────────────────────────────────────────────────

describe('crystallize', () => {
  it('returns a DOT', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    expect(dot).toBeDefined();
    expect(dot.payload).toBeDefined();
  });

  it('appends DOT to room chain', async () => {
    const { room, ai } = await makeRoomAI();
    const countBefore = room.chain.appendCount;
    await crystallize(room, ai, room.identity);
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('payload event is "crystallize"', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(payload.event).toBe('crystallize');
  });

  it('payload contains correct member count', async () => {
    const { room, ai } = await makeRoomAI();
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');

    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(payload.members).toBe(1);
  });

  it('payload contains mind count', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(typeof payload.minds).toBe('number');
    expect(payload.minds).toBe(2); // feynman + rumi
  });

  it('payload contains dotCount greater than zero', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(typeof payload.dotCount).toBe('number');
    expect(payload.dotCount).toBeGreaterThan(0);
  });

  it('payload contains topTopics array', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(Array.isArray(payload.topTopics)).toBe(true);
  });

  it('topTopics reflects active mind domains', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(payload.topTopics).toContain('physics');
    expect(payload.topTopics).toContain('poetry');
  });

  it('payload contains computeUsed field', async () => {
    const { room, ai } = await makeRoomAI();
    const identity = await createIdentity();
    // Use the AI first to accumulate some compute
    await ai.handleQuery('What is physics?', identity.publicKey);

    const dot = await crystallize(room, ai, room.identity);
    const payload = decodePayload(dot);
    expect(typeof payload.computeUsed).toBe('number');
    expect(payload.computeUsed).toBeGreaterThan(0);
  });

  it('payload contains timestamp', async () => {
    const { room, ai } = await makeRoomAI();
    const before = Date.now();
    const dot = await crystallize(room, ai, room.identity);
    const after = Date.now();
    const payload = decodePayload(dot);
    expect(typeof payload.timestamp).toBe('number');
    expect(payload.timestamp).toBeGreaterThanOrEqual(before);
    expect(payload.timestamp).toBeLessThanOrEqual(after);
  });

  it('DOT is signed by provided identity', async () => {
    const { room, ai } = await makeRoomAI();
    const dot = await crystallize(room, ai, room.identity);
    expect(dot.sign).toBeDefined();
    const observerHex = Buffer.from(dot.sign!.observer!).toString('hex');
    const expectedHex = Buffer.from(room.identity.publicKey).toString('hex');
    expect(observerHex).toBe(expectedHex);
  });

  it('can crystallize with a custom identity', async () => {
    const { room, ai } = await makeRoomAI();
    const customIdentity = await createIdentity();
    const dot = await crystallize(room, ai, customIdentity);
    const observerHex = Buffer.from(dot.sign!.observer!).toString('hex');
    const expectedHex = Buffer.from(customIdentity.publicKey).toString('hex');
    expect(observerHex).toBe(expectedHex);
  });
});
