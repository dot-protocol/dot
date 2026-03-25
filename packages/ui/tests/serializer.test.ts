/**
 * serializer.test.ts — Tests for toA2UI / fromA2UI roundtrip.
 * Target: 10+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { toA2UI, fromA2UI } from '../src/serializer.js';
import { composeRoomLayout } from '../src/composer.js';
import { resetIdCounter, generativeFace, observationFirst } from '../src/patterns.js';
import type { RoomLayout } from '../src/composer.js';

beforeEach(() => {
  resetIdCounter();
});

function makeLayout(): RoomLayout {
  return composeRoomLayout('.physics', {
    minds: [{ name: 'Feynman', domain: 'physics', active: true }],
    recentDots: [{ hash: 'abc123', content: 'light quanta', depth: 0, trust: 0.99 }],
    firstVisit: true,
  });
}

// ─── toA2UI ───────────────────────────────────────────────────────────────────

describe('toA2UI', () => {
  it('returns a string', () => {
    expect(typeof toA2UI(makeLayout())).toBe('string');
  });

  it('returns valid JSON', () => {
    expect(() => JSON.parse(toA2UI(makeLayout()))).not.toThrow();
  });

  it('envelope has a2ui version "1.0"', () => {
    const parsed = JSON.parse(toA2UI(makeLayout()));
    expect(parsed.a2ui).toBe('1.0');
  });

  it('envelope contains room name', () => {
    const parsed = JSON.parse(toA2UI(makeLayout()));
    expect(parsed.room).toBe('.physics');
  });

  it('envelope contains components array', () => {
    const parsed = JSON.parse(toA2UI(makeLayout()));
    expect(Array.isArray(parsed.components)).toBe(true);
  });

  it('components use "type" field (A2UI compat)', () => {
    const parsed = JSON.parse(toA2UI(makeLayout()));
    for (const c of parsed.components) {
      expect(typeof c.type).toBe('string');
    }
  });

  it('envelope contains theme', () => {
    const parsed = JSON.parse(toA2UI(makeLayout()));
    expect(['dark', 'light']).toContain(parsed.theme);
  });
});

// ─── fromA2UI ─────────────────────────────────────────────────────────────────

describe('fromA2UI', () => {
  it('parses valid A2UI JSON back to RoomLayout', () => {
    const layout = makeLayout();
    const parsed = fromA2UI(toA2UI(layout));
    expect(parsed.roomName).toBe('.physics');
  });

  it('throws on invalid JSON', () => {
    expect(() => fromA2UI('not json')).toThrow();
  });

  it('throws on unsupported A2UI version', () => {
    const json = JSON.stringify({ a2ui: '2.0', id: 'x', room: '.x', components: [] });
    expect(() => fromA2UI(json)).toThrow(/unsupported A2UI version/);
  });

  it('throws when id is missing', () => {
    const json = JSON.stringify({ a2ui: '1.0', room: '.x', components: [] });
    expect(() => fromA2UI(json)).toThrow(/id/);
  });

  it('throws when room is missing', () => {
    const json = JSON.stringify({ a2ui: '1.0', id: 'x', components: [] });
    expect(() => fromA2UI(json)).toThrow(/room/);
  });

  it('throws when components is not an array', () => {
    const json = JSON.stringify({ a2ui: '1.0', id: 'x', room: '.x', components: null });
    expect(() => fromA2UI(json)).toThrow(/components/);
  });
});

// ─── Roundtrip ────────────────────────────────────────────────────────────────

describe('toA2UI / fromA2UI roundtrip', () => {
  it('roomName survives roundtrip', () => {
    const layout = makeLayout();
    expect(fromA2UI(toA2UI(layout)).roomName).toBe(layout.roomName);
  });

  it('theme survives roundtrip', () => {
    const layout = makeLayout();
    expect(fromA2UI(toA2UI(layout)).theme).toBe(layout.theme);
  });

  it('component count survives roundtrip', () => {
    const layout = makeLayout();
    const restored = fromA2UI(toA2UI(layout));
    expect(restored.components.length).toBe(layout.components.length);
  });

  it('component patterns survive roundtrip', () => {
    const layout = makeLayout();
    const restored = fromA2UI(toA2UI(layout));
    const origPatterns = layout.components.map((c) => c.pattern);
    const restPatterns = restored.components.map((c) => c.pattern);
    expect(restPatterns).toEqual(origPatterns);
  });

  it('component props survive roundtrip', () => {
    const layout = makeLayout();
    const restored = fromA2UI(toA2UI(layout));
    for (let i = 0; i < layout.components.length; i++) {
      expect(restored.components[i]!.props).toEqual(layout.components[i]!.props);
    }
  });

  it('light theme roundtrips correctly', () => {
    const layout = composeRoomLayout('.room', { theme: 'light' });
    expect(fromA2UI(toA2UI(layout)).theme).toBe('light');
  });

  it('generative-face with children survives roundtrip', () => {
    const face = generativeFace({ language: 'fr', expertise: 'expert' }, [observationFirst()]);
    const layout: RoomLayout = {
      id: 'test',
      roomName: '.face',
      components: [face],
      theme: 'dark',
      generatedAt: new Date().toISOString(),
    };
    const restored = fromA2UI(toA2UI(layout));
    expect(restored.components[0]!.children).toHaveLength(1);
  });
});
