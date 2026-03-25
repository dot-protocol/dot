/**
 * stop.test.ts — Stop condition enforcement tests.
 */

import { describe, it, expect } from 'vitest';
import { checkStopConditions, isRoomBlocked } from '../src/stop.js';
import type { KinState, StopConditions } from '../src/types.js';

// Helper: build a minimal KinState for testing
function makeState(overrides: Partial<KinState> = {}): KinState {
  return {
    identity: { publicKey: new Uint8Array(32), shortcode: 'abcd1234' },
    dotsCreated: 0,
    dotsVerified: 0,
    roomsVisited: [],
    sessionStart: Date.now(),
    stopConditions: {},
    privacyLevel: 'balanced',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// checkStopConditions — allowed cases
// ---------------------------------------------------------------------------

describe('checkStopConditions — allowed', () => {
  it('allows when no conditions are set', () => {
    const result = checkStopConditions(makeState(), {});
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows when dotsCreated is below maxDailyDots', () => {
    const result = checkStopConditions(makeState({ dotsCreated: 4 }), { maxDailyDots: 5 });
    expect(result.allowed).toBe(true);
  });

  it('allows when session time is under the limit', () => {
    const result = checkStopConditions(
      makeState({ sessionStart: Date.now() - 60_000 }), // 1 minute ago
      { maxSessionMinutes: 10 }
    );
    expect(result.allowed).toBe(true);
  });

  it('allows when room is not in blocked list', () => {
    const result = checkStopConditions(
      makeState(),
      { blockedRooms: ['bad.room'] },
      'good.room'
    );
    expect(result.allowed).toBe(true);
  });

  it('allows when blockedRooms is set but no current room', () => {
    const result = checkStopConditions(makeState(), { blockedRooms: ['bad.room'] });
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkStopConditions — maxDailyDots
// ---------------------------------------------------------------------------

describe('checkStopConditions — maxDailyDots', () => {
  it('stops when dotsCreated equals maxDailyDots', () => {
    const result = checkStopConditions(makeState({ dotsCreated: 10 }), { maxDailyDots: 10 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('10/10');
  });

  it('stops when dotsCreated exceeds maxDailyDots', () => {
    const result = checkStopConditions(makeState({ dotsCreated: 15 }), { maxDailyDots: 10 });
    expect(result.allowed).toBe(false);
  });

  it('includes limit info in reason', () => {
    const result = checkStopConditions(makeState({ dotsCreated: 5 }), { maxDailyDots: 5 });
    expect(result.reason).toContain('daily DOT limit');
  });
});

// ---------------------------------------------------------------------------
// checkStopConditions — maxSessionMinutes
// ---------------------------------------------------------------------------

describe('checkStopConditions — maxSessionMinutes', () => {
  it('stops when session exceeds limit', () => {
    const result = checkStopConditions(
      makeState({ sessionStart: Date.now() - 61 * 60_000 }), // 61 minutes ago
      { maxSessionMinutes: 60 }
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('session time limit');
  });

  it('allows when session is exactly at limit minus 1 second', () => {
    const result = checkStopConditions(
      makeState({ sessionStart: Date.now() - 59 * 60_000 }), // 59 min ago
      { maxSessionMinutes: 60 }
    );
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkStopConditions — blockedRooms
// ---------------------------------------------------------------------------

describe('checkStopConditions — blockedRooms', () => {
  it('stops when current room is blocked', () => {
    const result = checkStopConditions(
      makeState(),
      { blockedRooms: ['nsfw.room', 'spam.room'] },
      'nsfw.room'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('nsfw.room');
  });

  it('stops on exact match', () => {
    const result = checkStopConditions(
      makeState(),
      { blockedRooms: ['bad.room'] },
      'bad.room'
    );
    expect(result.allowed).toBe(false);
  });

  it('does not match partial room name', () => {
    const result = checkStopConditions(
      makeState(),
      { blockedRooms: ['bad.room'] },
      'notbad.room'
    );
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkStopConditions — multiple conditions
// ---------------------------------------------------------------------------

describe('checkStopConditions — multiple conditions', () => {
  it('blockedRooms takes priority over dot count', () => {
    const result = checkStopConditions(
      makeState({ dotsCreated: 0 }),
      { maxDailyDots: 100, blockedRooms: ['bad.room'] },
      'bad.room'
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('bad.room');
  });

  it('allows when all conditions pass', () => {
    const result = checkStopConditions(
      makeState({ dotsCreated: 5, sessionStart: Date.now() - 10_000 }),
      { maxDailyDots: 100, maxSessionMinutes: 60, blockedRooms: ['bad.room'] },
      'good.room'
    );
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isRoomBlocked
// ---------------------------------------------------------------------------

describe('isRoomBlocked', () => {
  it('returns true for exact match', () => {
    expect(isRoomBlocked('bad.room', ['bad.room', 'spam.room'])).toBe(true);
  });

  it('returns false when room not in list', () => {
    expect(isRoomBlocked('good.room', ['bad.room'])).toBe(false);
  });

  it('returns false for empty blocked list', () => {
    expect(isRoomBlocked('any.room', [])).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isRoomBlocked('Bad.Room', ['bad.room'])).toBe(false);
  });

  it('returns true when multiple rooms blocked and one matches', () => {
    expect(isRoomBlocked('target.room', ['alpha.room', 'target.room', 'beta.room'])).toBe(true);
  });

  it('returns false when room is substring of blocked entry', () => {
    expect(isRoomBlocked('bad', ['bad.room'])).toBe(false);
  });
});
