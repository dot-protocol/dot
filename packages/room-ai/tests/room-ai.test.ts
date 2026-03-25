/**
 * room-ai.test.ts — Room AI governance engine tests.
 * Target: 35+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { createRoom, activateMind as activateRoomMind, createMind as createRoomMind } from '@dot-protocol/room';
import { createFeynman, createRumi, createShannon } from '@dot-protocol/minds';
import { RoomAI } from '../src/room-ai.js';
import type { RoomAIConfig } from '../src/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeRoom(name = '.test') {
  return createRoom(name);
}

async function makeAI(
  roomName = '.test',
  config?: Partial<RoomAIConfig>,
) {
  const room = await makeRoom(roomName);
  const feynman = await createFeynman();
  const rumi = await createRumi();
  const shannon = await createShannon();
  const ai = new RoomAI(room, [feynman, rumi, shannon], config);
  return { room, ai, feynman, rumi, shannon };
}

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('RoomAI constructor', () => {
  it('initializes with default config when none provided', async () => {
    const { ai } = await makeAI();
    expect(ai.config.maxMindsPerQuery).toBe(3);
    expect(ai.config.relevanceThreshold).toBe(0.3);
    expect(ai.config.computeBudget).toBe(4096);
    expect(ai.config.crossRoomEnabled).toBe(true);
    expect(ai.config.stateDotInterval).toBe(10);
  });

  it('merges partial config with defaults', async () => {
    const { ai } = await makeAI('.test', { maxMindsPerQuery: 1, crossRoomEnabled: false });
    expect(ai.config.maxMindsPerQuery).toBe(1);
    expect(ai.config.crossRoomEnabled).toBe(false);
    expect(ai.config.computeBudget).toBe(4096); // default preserved
  });

  it('initializes computeUsage with zero tokensUsed', async () => {
    const { ai } = await makeAI();
    const usage = ai.getComputeUsage();
    expect(usage.tokensUsed).toBe(0);
    expect(usage.mindsActivated).toBe(0);
  });

  it('initializes observationCount at zero', async () => {
    const { ai } = await makeAI();
    expect(ai.observationCount).toBe(0);
  });

  it('stores room and minds references', async () => {
    const { room, ai, feynman } = await makeAI();
    expect(ai.room).toBe(room);
    expect(ai.minds).toContain(feynman);
  });
});

// ─── routeToMinds ─────────────────────────────────────────────────────────────

describe('routeToMinds', () => {
  it('returns empty array when no minds match', async () => {
    const { ai } = await makeAI();
    const minds = ai.routeToMinds('tell me a story about dragons');
    expect(minds).toHaveLength(0);
  });

  it('physics query activates Feynman', async () => {
    const { ai } = await makeAI();
    const minds = ai.routeToMinds('What is quantum physics?');
    const ids = minds.map((m) => m.config.id);
    expect(ids).toContain('feynman');
  });

  it('poetry query activates Rumi', async () => {
    const { ai } = await makeAI();
    const minds = ai.routeToMinds('Write me a poem about love');
    const ids = minds.map((m) => m.config.id);
    expect(ids).toContain('rumi');
  });

  it('information query activates Shannon', async () => {
    const { ai } = await makeAI();
    const minds = ai.routeToMinds('How does information theory work?');
    const ids = minds.map((m) => m.config.id);
    expect(ids).toContain('shannon');
  });

  it('respects maxMindsPerQuery limit', async () => {
    const { ai } = await makeAI('.test', { maxMindsPerQuery: 1 });
    // Add more minds with overlapping domains
    const minds = ai.routeToMinds('physics mathematics science');
    expect(minds.length).toBeLessThanOrEqual(1);
  });

  it('returns no more than maxMindsPerQuery even with many matches', async () => {
    const { ai } = await makeAI('.test', { maxMindsPerQuery: 2 });
    const minds = ai.routeToMinds('physics mathematics information science entropy');
    expect(minds.length).toBeLessThanOrEqual(2);
  });

  it('completely unrelated query returns no minds', async () => {
    const { ai } = await makeAI();
    const minds = ai.routeToMinds('what is the best pizza topping');
    expect(minds).toHaveLength(0);
  });

  it('case-insensitive matching (PHYSICS)', async () => {
    const { ai } = await makeAI();
    const minds = ai.routeToMinds('PHYSICS question here');
    const ids = minds.map((m) => m.config.id);
    expect(ids).toContain('feynman');
  });
});

// ─── handleQuery ──────────────────────────────────────────────────────────────

describe('handleQuery', () => {
  it('returns mindResponses array', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    const result = await ai.handleQuery('What is quantum physics?', identity.publicKey);
    expect(Array.isArray(result.mindResponses)).toBe(true);
  });

  it('activates relevant minds for physics query', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    const result = await ai.handleQuery('Tell me about physics and energy', identity.publicKey);
    const ids = result.mindResponses.map((r) => r.mind);
    expect(ids).toContain('feynman');
  });

  it('returns empty mindResponses for irrelevant query', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    const result = await ai.handleQuery('best pizza topping ever', identity.publicKey);
    expect(result.mindResponses).toHaveLength(0);
  });

  it('each mindResponse has required fields', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    const result = await ai.handleQuery('What is physics?', identity.publicKey);
    for (const r of result.mindResponses) {
      expect(typeof r.mind).toBe('string');
      expect(typeof r.response).toBe('string');
      expect(Array.isArray(r.citations)).toBe(true);
      expect(typeof r.confidence).toBe('number');
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('increments observationCount on each call', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    expect(ai.observationCount).toBe(0);
    await ai.handleQuery('physics question', identity.publicKey);
    expect(ai.observationCount).toBe(1);
    await ai.handleQuery('poetry question', identity.publicKey);
    expect(ai.observationCount).toBe(2);
  });

  it('tracks computeUsage after query', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    await ai.handleQuery('What is quantum mechanics in physics?', identity.publicKey);
    const usage = ai.getComputeUsage();
    expect(usage.tokensUsed).toBeGreaterThan(0);
    expect(usage.remaining).toBeLessThan(usage.budget);
  });

  it('increments mindsActivated in computeUsage', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    await ai.handleQuery('physics quantum energy', identity.publicKey);
    const usage = ai.getComputeUsage();
    expect(usage.mindsActivated).toBeGreaterThan(0);
  });

  it('returns crossRoomLinks array when crossRoomEnabled', async () => {
    const { ai } = await makeAI('.test', { crossRoomEnabled: true });
    ai.registerKnownRoom({ name: '.physics', keywords: ['physics', 'quantum'], mindDomains: ['physics'] });
    const identity = await createIdentity();
    const result = await ai.handleQuery('What is quantum physics?', identity.publicKey);
    expect(Array.isArray(result.crossRoomLinks)).toBe(true);
  });

  it('returns empty crossRoomLinks when crossRoomEnabled is false', async () => {
    const { ai } = await makeAI('.test', { crossRoomEnabled: false });
    const identity = await createIdentity();
    const result = await ai.handleQuery('What is quantum physics?', identity.publicKey);
    expect(result.crossRoomLinks).toHaveLength(0);
  });

  it('creates state DOT at interval', async () => {
    const { ai, room } = await makeAI('.test', { stateDotInterval: 3 });
    const identity = await createIdentity();
    const countBefore = room.chain.appendCount;

    // 3 observations should trigger a state DOT at the 3rd
    let lastResult;
    for (let i = 0; i < 3; i++) {
      lastResult = await ai.handleQuery('physics question', identity.publicKey);
    }
    expect(lastResult?.stateDot).toBeDefined();
  });

  it('does not create state DOT before interval', async () => {
    const { ai } = await makeAI('.test', { stateDotInterval: 10 });
    const identity = await createIdentity();
    // Only 2 observations — no state DOT yet
    const result1 = await ai.handleQuery('physics', identity.publicKey);
    const result2 = await ai.handleQuery('poetry', identity.publicKey);
    expect(result1.stateDot).toBeUndefined();
    expect(result2.stateDot).toBeUndefined();
  });

  it('returns no stateDot when stateDotInterval is 0', async () => {
    const { ai } = await makeAI('.test', { stateDotInterval: 0 });
    const identity = await createIdentity();
    let result;
    for (let i = 0; i < 5; i++) {
      result = await ai.handleQuery('physics', identity.publicKey);
    }
    expect(result?.stateDot).toBeUndefined();
  });
});

// ─── enforceStop ──────────────────────────────────────────────────────────────

describe('enforceStop', () => {
  it('always returns false (Kin enforces stop)', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    expect(ai.enforceStop(identity.publicKey)).toBe(false);
  });

  it('returns false even after many interactions', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    for (let i = 0; i < 100; i++) {
      await ai.handleQuery('physics', identity.publicKey);
    }
    expect(ai.enforceStop(identity.publicKey)).toBe(false);
  });
});

// ─── createStateDOT ───────────────────────────────────────────────────────────

describe('createStateDOT', () => {
  it('appends a DOT to the room chain', async () => {
    const { ai, room } = await makeAI();
    const countBefore = room.chain.appendCount;
    await ai.createStateDOT();
    expect(room.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns a DOT with payload', async () => {
    const { ai } = await makeAI();
    const dot = await ai.createStateDOT();
    expect(dot.payload).toBeDefined();
    expect(dot.payload!.length).toBeGreaterThan(0);
  });

  it('state DOT payload is valid JSON', async () => {
    const { ai } = await makeAI();
    const dot = await ai.createStateDOT();
    const text = new TextDecoder().decode(dot.payload);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('state DOT is signed by room identity', async () => {
    const { ai, room } = await makeAI();
    const dot = await ai.createStateDOT();
    const observerHex = Buffer.from(dot.sign!.observer!).toString('hex');
    const roomPubHex = Buffer.from(room.identity.publicKey).toString('hex');
    expect(observerHex).toBe(roomPubHex);
  });
});

// ─── getComputeUsage ──────────────────────────────────────────────────────────

describe('getComputeUsage', () => {
  it('returns a copy of compute usage (not reference)', async () => {
    const { ai } = await makeAI();
    const usage1 = ai.getComputeUsage();
    const usage2 = ai.getComputeUsage();
    expect(usage1).not.toBe(usage2);
    expect(usage1).toEqual(usage2);
  });

  it('budget equals configured computeBudget', async () => {
    const { ai } = await makeAI('.test', { computeBudget: 2048 });
    const usage = ai.getComputeUsage();
    expect(usage.budget).toBe(2048);
  });

  it('remaining starts equal to budget', async () => {
    const { ai } = await makeAI('.test', { computeBudget: 2048 });
    const usage = ai.getComputeUsage();
    expect(usage.remaining).toBe(2048);
  });

  it('remaining decreases after queries', async () => {
    const { ai } = await makeAI();
    const identity = await createIdentity();
    await ai.handleQuery('What is quantum physics?', identity.publicKey);
    const usage = ai.getComputeUsage();
    expect(usage.remaining).toBeLessThan(usage.budget);
  });
});

// ─── registerKnownRoom ────────────────────────────────────────────────────────

describe('registerKnownRoom', () => {
  it('registers a room for cross-room correlation', async () => {
    const { ai } = await makeAI();
    ai.registerKnownRoom({ name: '.poetry', keywords: ['poem', 'verse', 'love'], mindDomains: ['poetry'] });
    // Verify it's used in correlation
    const identity = await createIdentity();
    const result = await ai.handleQuery('I love poetry and verse', identity.publicKey);
    expect(result.crossRoomLinks.some((l) => l.room === '.poetry')).toBe(true);
  });
});
