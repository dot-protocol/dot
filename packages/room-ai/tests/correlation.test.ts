/**
 * correlation.test.ts — CorrelationEngine tests.
 * Target: 20+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { observe, sign, createIdentity } from '@dot-protocol/core';
import { CorrelationEngine } from '../src/correlation.js';
import type { KnownRoom } from '../src/correlation.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEngine(threshold = 0.1) {
  return new CorrelationEngine(threshold);
}

const PHYSICS_ROOM: KnownRoom = {
  name: '.physics',
  keywords: ['quantum', 'energy', 'entropy', 'particle', 'mechanics', 'physics'],
  mindDomains: ['physics', 'mathematics'],
};

const POETRY_ROOM: KnownRoom = {
  name: '.poetry',
  keywords: ['poem', 'verse', 'love', 'beauty', 'soul', 'poetry', 'spiritual'],
  mindDomains: ['poetry', 'spirituality'],
};

const MATH_ROOM: KnownRoom = {
  name: '.math',
  keywords: ['theorem', 'proof', 'calculus', 'algebra', 'geometry', 'mathematics'],
  mindDomains: ['mathematics', 'logic'],
};

// ─── registerRoom ─────────────────────────────────────────────────────────────

describe('registerRoom', () => {
  it('adds a room to knownRooms', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    expect(engine.knownRooms.size).toBe(1);
    expect(engine.knownRooms.has('.physics')).toBe(true);
  });

  it('overwrites existing room with same name', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    engine.registerRoom({ ...PHYSICS_ROOM, keywords: ['updated'] });
    expect(engine.knownRooms.size).toBe(1);
    expect(engine.knownRooms.get('.physics')?.keywords).toEqual(['updated']);
  });

  it('stores a copy, not a reference', () => {
    const engine = makeEngine();
    const room = { ...PHYSICS_ROOM };
    engine.registerRoom(room);
    room.keywords.push('mutated');
    expect(engine.knownRooms.get('.physics')?.keywords).not.toContain('mutated');
  });

  it('can register multiple rooms', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    engine.registerRoom(POETRY_ROOM);
    engine.registerRoom(MATH_ROOM);
    expect(engine.knownRooms.size).toBe(3);
  });
});

// ─── unregisterRoom ───────────────────────────────────────────────────────────

describe('unregisterRoom', () => {
  it('removes a registered room', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    engine.unregisterRoom('.physics');
    expect(engine.knownRooms.has('.physics')).toBe(false);
  });

  it('is a no-op for unknown room', () => {
    const engine = makeEngine();
    expect(() => engine.unregisterRoom('.nonexistent')).not.toThrow();
  });
});

// ─── findCorrelations ─────────────────────────────────────────────────────────

describe('findCorrelations', () => {
  it('returns empty array when no rooms registered', () => {
    const engine = makeEngine();
    const links = engine.findCorrelations('quantum physics question', '');
    expect(links).toHaveLength(0);
  });

  it('returns relevant rooms above threshold', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('What is quantum mechanics?', 'Energy and particles');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]?.room).toBe('.physics');
  });

  it('does not return rooms below threshold', () => {
    const engine = makeEngine(0.9); // very high threshold
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('quantum', 'energy');
    // With such a high threshold, this should return nothing
    expect(links.length).toBe(0);
  });

  it('physics query in .general suggests .physics', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('quantum physics energy mechanics', 'particles and waves');
    expect(links.some((l) => l.room === '.physics')).toBe(true);
  });

  it('poetry query suggests .poetry room', () => {
    const engine = makeEngine();
    engine.registerRoom(POETRY_ROOM);
    const links = engine.findCorrelations('beautiful poetry about love and soul', 'verses of spiritual beauty');
    expect(links.some((l) => l.room === '.poetry')).toBe(true);
  });

  it('unrelated query produces no correlations', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    engine.registerRoom(POETRY_ROOM);
    const links = engine.findCorrelations('best pizza topping ever', 'cheese and tomato');
    expect(links).toHaveLength(0);
  });

  it('returns links sorted by relevance descending', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    engine.registerRoom(POETRY_ROOM);
    engine.registerRoom(MATH_ROOM);
    const links = engine.findCorrelations(
      'quantum physics mathematics theorem proof',
      'calculus and energy equations',
    );
    for (let i = 1; i < links.length; i++) {
      expect(links[i - 1]!.relevance).toBeGreaterThanOrEqual(links[i]!.relevance);
    }
  });

  it('each link has room, relevance, and reason', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('quantum physics energy', 'particles');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(typeof link.room).toBe('string');
      expect(typeof link.relevance).toBe('number');
      expect(typeof link.reason).toBe('string');
      expect(link.relevance).toBeGreaterThanOrEqual(0);
      expect(link.relevance).toBeLessThanOrEqual(1);
    }
  });

  it('excludes current room from correlations', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('quantum physics', 'energy', '.physics');
    expect(links.some((l) => l.room === '.physics')).toBe(false);
  });

  it('does not exclude rooms when no excludeRoom provided', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('quantum physics energy mechanics', 'particles waves');
    expect(links.some((l) => l.room === '.physics')).toBe(true);
  });

  it('reason string is non-empty', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const links = engine.findCorrelations('quantum physics', 'energy');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!.reason.length).toBeGreaterThan(0);
  });

  it('domain-only match still produces correlation', () => {
    const engine = makeEngine();
    engine.registerRoom({ name: '.math', keywords: [], mindDomains: ['mathematics'] });
    const links = engine.findCorrelations('mathematics theory', 'mathematical proof');
    expect(links.some((l) => l.room === '.math')).toBe(true);
  });
});

// ─── suggestDoorways ──────────────────────────────────────────────────────────

describe('suggestDoorways', () => {
  it('returns empty array for empty recentDots', () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);
    const suggestions = engine.suggestDoorways('.general', []);
    expect(suggestions).toHaveLength(0);
  });

  it('returns doorway suggestions based on DOT payloads', async () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);

    const identity = await createIdentity();
    const dot = observe(
      { event: 'query', content: 'quantum physics energy mechanics' },
      { type: 'claim', plaintext: true },
    );
    const signed = await sign(dot, identity.secretKey);

    const suggestions = engine.suggestDoorways('.general', [signed]);
    expect(suggestions.some((s) => s.targetRoom === '.physics')).toBe(true);
  });

  it('each suggestion has targetRoom and reason', async () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);

    const identity = await createIdentity();
    const dot = observe(
      { content: 'quantum physics particle mechanics energy' },
      { type: 'claim', plaintext: true },
    );
    const signed = await sign(dot, identity.secretKey);

    const suggestions = engine.suggestDoorways('.general', [signed]);
    for (const s of suggestions) {
      expect(typeof s.targetRoom).toBe('string');
      expect(typeof s.reason).toBe('string');
    }
  });

  it('skips DOTs with unparseable payloads gracefully', async () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);

    // DOT with no payload
    const badDot = { payload: undefined };
    expect(() =>
      engine.suggestDoorways('.general', [badDot as any]),
    ).not.toThrow();
  });

  it('excludes current room from doorway suggestions', async () => {
    const engine = makeEngine();
    engine.registerRoom(PHYSICS_ROOM);

    const identity = await createIdentity();
    const dot = observe(
      { content: 'quantum physics energy' },
      { type: 'claim', plaintext: true },
    );
    const signed = await sign(dot, identity.secretKey);

    const suggestions = engine.suggestDoorways('.physics', [signed]);
    expect(suggestions.every((s) => s.targetRoom !== '.physics')).toBe(true);
  });
});
