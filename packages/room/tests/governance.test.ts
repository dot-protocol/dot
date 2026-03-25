/**
 * governance.test.ts — Room governance tests.
 * Target: 15+ tests.
 */

import { describe, it, expect } from 'vitest';
import { createRoom } from '../src/room.js';
import { createMind, activateMind } from '../src/mind.js';
import { shouldActivateMind, routeQuery, createStateDOT } from '../src/governance.js';
import type { Mind } from '../src/types.js';

// --- shouldActivateMind ---

describe('shouldActivateMind', () => {
  it('returns true when query contains domain word', async () => {
    const mind: Mind = {
      id: 'feynman',
      name: 'Feynman',
      publicKey: new Uint8Array(32),
      domain: 'physics',
      active: true,
    };
    expect(shouldActivateMind('What is quantum physics?', mind)).toBe(true);
  });

  it('returns false when query does not match domain', async () => {
    const mind: Mind = {
      id: 'feynman',
      name: 'Feynman',
      publicKey: new Uint8Array(32),
      domain: 'physics',
      active: true,
    };
    expect(shouldActivateMind('Write me a poem about roses', mind)).toBe(false);
  });

  it('returns false when mind is inactive', async () => {
    const mind: Mind = {
      id: 'feynman',
      name: 'Feynman',
      publicKey: new Uint8Array(32),
      domain: 'physics',
      active: false,
    };
    expect(shouldActivateMind('What is quantum physics?', mind)).toBe(false);
  });

  it('matches domain case-insensitively', async () => {
    const mind: Mind = {
      id: 'rumi',
      name: 'Rumi',
      publicKey: new Uint8Array(32),
      domain: 'poetry',
      active: true,
    };
    expect(shouldActivateMind('I love POETRY', mind)).toBe(true);
  });

  it('matches partial domain word (domain is substring of word)', async () => {
    const mind: Mind = {
      id: 'test',
      name: 'Test',
      publicKey: new Uint8Array(32),
      domain: 'math',
      active: true,
    };
    // "mathematics" contains "math"
    expect(shouldActivateMind('mathematics theorem', mind)).toBe(true);
  });
});

// --- routeQuery ---

describe('routeQuery', () => {
  it('returns relevant minds for a query', async () => {
    const room = await createRoom('.test');
    const physics = await createMind('feynman', 'Feynman', 'physics');
    const poetry = await createMind('rumi', 'Rumi', 'poetry');
    await activateMind(room, physics);
    await activateMind(room, poetry);

    const minds = routeQuery(room, 'Tell me about physics');
    expect(minds.length).toBe(1);
    expect(minds[0]?.name).toBe('Feynman');
  });

  it('returns empty array when no minds match query', async () => {
    const room = await createRoom('.test');
    const physics = await createMind('feynman', 'Feynman', 'physics');
    await activateMind(room, physics);

    const minds = routeQuery(room, 'Tell me a joke');
    expect(minds.length).toBe(0);
  });

  it('returns multiple minds when query matches multiple domains', async () => {
    const room = await createRoom('.test');
    const physics = await createMind('feynman', 'Feynman', 'physics');
    const math = await createMind('euler', 'Euler', 'math');
    await activateMind(room, physics);
    await activateMind(room, math);

    const minds = routeQuery(room, 'physics and math interplay');
    expect(minds.length).toBe(2);
  });

  it('respects maxMindsPerQuery config', async () => {
    const room = await createRoom('.test');
    const m1 = await createMind('m1', 'M1', 'science');
    const m2 = await createMind('m2', 'M2', 'science');
    const m3 = await createMind('m3', 'M3', 'science');
    const m4 = await createMind('m4', 'M4', 'science');
    await activateMind(room, m1);
    await activateMind(room, m2);
    await activateMind(room, m3);
    await activateMind(room, m4);

    const minds = routeQuery(room, 'science question', {
      maxMindsPerQuery: 2,
      relevanceThreshold: 0.5,
      computeBudget: 1000,
    });
    expect(minds.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when room has no minds', async () => {
    const room = await createRoom('.test');
    const minds = routeQuery(room, 'anything');
    expect(minds.length).toBe(0);
  });

  it('skips inactive minds', async () => {
    const room = await createRoom('.test');
    const physics = await createMind('feynman', 'Feynman', 'physics');
    // Add inactive mind directly (not via activateMind)
    room.minds.set('feynman', { ...physics, active: false });

    const minds = routeQuery(room, 'Tell me about physics');
    expect(minds.length).toBe(0);
  });

  it('returns default 3 max minds with default config', async () => {
    const room = await createRoom('.test');
    // Add 5 science minds
    for (let i = 0; i < 5; i++) {
      const m = await createMind(`m${i}`, `Mind${i}`, 'science');
      await activateMind(room, m);
    }
    const minds = routeQuery(room, 'science question');
    expect(minds.length).toBeLessThanOrEqual(3);
  });
});

// --- createStateDOT ---

describe('createStateDOT', () => {
  it('creates a state DOT and appends to chain', async () => {
    const room = await createRoom('.test');
    const countBefore = room.chain.appendCount;
    await createStateDOT(room);
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('state DOT is signed by room identity', async () => {
    const room = await createRoom('.test');
    const dot = await createStateDOT(room);
    const observerHex = Buffer.from(dot.sign!.observer!).toString('hex');
    const roomPubHex = Buffer.from(room.identity.publicKey).toString('hex');
    expect(observerHex).toBe(roomPubHex);
  });

  it('state DOT payload contains memberCount', async () => {
    const room = await createRoom('.test');
    const { createIdentity } = await import('@dot-protocol/core');
    const { joinRoom } = await import('../src/room.js');
    const alice = await createIdentity();
    await joinRoom(room, alice, 'Alice');

    const dot = await createStateDOT(room);
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(obj.memberCount).toBe(1);
  });

  it('state DOT payload contains dotCount', async () => {
    const room = await createRoom('.test');
    const dot = await createStateDOT(room);
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(typeof obj.dotCount).toBe('number');
    expect(obj.dotCount).toBeGreaterThan(0);
  });

  it('state DOT payload contains stateHash', async () => {
    const room = await createRoom('.test');
    const dot = await createStateDOT(room);
    const text = new TextDecoder().decode(dot.payload);
    const obj = JSON.parse(text);
    expect(typeof obj.stateHash).toBe('string');
    expect(obj.stateHash.length).toBeGreaterThan(0);
  });
});
