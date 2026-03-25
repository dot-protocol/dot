/**
 * composer.test.ts — Tests for composeRoomLayout.
 * Target: 20+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { composeRoomLayout, type RoomLayout } from '../src/composer.js';
import { resetIdCounter } from '../src/patterns.js';

beforeEach(() => {
  resetIdCounter();
});

function patternNames(layout: RoomLayout): string[] {
  return layout.components.map((c) => c.pattern);
}

// ─── Basic layout structure ───────────────────────────────────────────────────

describe('composeRoomLayout — basics', () => {
  it('returns a RoomLayout object', () => {
    const layout = composeRoomLayout('.test');
    expect(typeof layout).toBe('object');
    expect(layout).not.toBeNull();
  });

  it('sets roomName correctly', () => {
    const layout = composeRoomLayout('.physics');
    expect(layout.roomName).toBe('.physics');
  });

  it('defaults to dark theme', () => {
    expect(composeRoomLayout('.x').theme).toBe('dark');
  });

  it('accepts light theme option', () => {
    expect(composeRoomLayout('.x', { theme: 'light' }).theme).toBe('light');
  });

  it('id contains the room name', () => {
    const layout = composeRoomLayout('.physics');
    expect(layout.id).toContain('.physics');
  });

  it('generatedAt is an ISO timestamp string', () => {
    const layout = composeRoomLayout('.x');
    expect(() => new Date(layout.generatedAt)).not.toThrow();
    expect(layout.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('components is an array', () => {
    expect(Array.isArray(composeRoomLayout('.x').components)).toBe(true);
  });
});

// ─── Observation First is always present ─────────────────────────────────────

describe('composeRoomLayout — observation-first always present', () => {
  it('always includes observation-first', () => {
    const layout = composeRoomLayout('.room');
    expect(patternNames(layout)).toContain('observation-first');
  });

  it('observation-first is the first component', () => {
    const layout = composeRoomLayout('.room');
    expect(layout.components[0]!.pattern).toBe('observation-first');
  });

  it('observation-first is present even with no options', () => {
    expect(patternNames(composeRoomLayout('.x'))[0]).toBe('observation-first');
  });

  it('observation-first uses custom placeholder when provided', () => {
    const layout = composeRoomLayout('.room', { inputPlaceholder: 'Share now...' });
    const obs = layout.components.find((c) => c.pattern === 'observation-first')!;
    expect(obs.props.placeholder).toBe('Share now...');
  });

  it('observation-first stores the room name', () => {
    const layout = composeRoomLayout('.mycroft');
    const obs = layout.components.find((c) => c.pattern === 'observation-first')!;
    expect(obs.props.room).toBe('.mycroft');
  });
});

// ─── Threshold on first visit ─────────────────────────────────────────────────

describe('composeRoomLayout — threshold on first visit', () => {
  it('includes threshold when firstVisit is true', () => {
    const layout = composeRoomLayout('.room', { firstVisit: true });
    expect(patternNames(layout)).toContain('threshold');
  });

  it('does not include threshold when firstVisit is false', () => {
    const layout = composeRoomLayout('.room', { firstVisit: false });
    expect(patternNames(layout)).not.toContain('threshold');
  });

  it('does not include threshold when firstVisit is not provided', () => {
    expect(patternNames(composeRoomLayout('.room'))).not.toContain('threshold');
  });

  it('threshold question mentions the room name', () => {
    const layout = composeRoomLayout('.poetry', { firstVisit: true });
    const thr = layout.components.find((c) => c.pattern === 'threshold')!;
    expect(thr.props.question as string).toContain('.poetry');
  });
});

// ─── Mind presence ────────────────────────────────────────────────────────────

describe('composeRoomLayout — mind-presence', () => {
  const minds = [
    { name: 'Feynman', domain: 'physics' },
    { name: 'Rumi', domain: 'poetry' },
  ];

  it('includes mind-presence when minds are provided', () => {
    const layout = composeRoomLayout('.room', { minds });
    expect(patternNames(layout)).toContain('mind-presence');
  });

  it('does not include mind-presence when no minds provided', () => {
    expect(patternNames(composeRoomLayout('.room'))).not.toContain('mind-presence');
  });

  it('does not include mind-presence for empty minds array', () => {
    expect(patternNames(composeRoomLayout('.room', { minds: [] }))).not.toContain('mind-presence');
  });

  it('mind-presence component contains the minds', () => {
    const layout = composeRoomLayout('.room', { minds });
    const mp = layout.components.find((c) => c.pattern === 'mind-presence')!;
    expect((mp.props.minds as typeof minds).length).toBe(2);
  });

  it('minds default active to false when not specified', () => {
    const layout = composeRoomLayout('.room', { minds: [{ name: 'X', domain: 'y' }] });
    const mp = layout.components.find((c) => c.pattern === 'mind-presence')!;
    const m = (mp.props.minds as { name: string; domain: string; active: boolean }[])[0]!;
    expect(m.active).toBe(false);
  });
});

// ─── Chain beneath ────────────────────────────────────────────────────────────

describe('composeRoomLayout — chain-beneath', () => {
  const dots = [
    { hash: 'aaa', content: 'first', depth: 0, trust: 0.9 },
    { hash: 'bbb', content: 'second', depth: 1, trust: 0.8 },
  ];

  it('includes chain-beneath when recentDots are provided', () => {
    expect(patternNames(composeRoomLayout('.room', { recentDots: dots }))).toContain(
      'chain-beneath',
    );
  });

  it('does not include chain-beneath when no dots', () => {
    expect(patternNames(composeRoomLayout('.room'))).not.toContain('chain-beneath');
  });

  it('does not include chain-beneath for empty dots array', () => {
    expect(
      patternNames(composeRoomLayout('.room', { recentDots: [] })),
    ).not.toContain('chain-beneath');
  });
});

// ─── Doorways ─────────────────────────────────────────────────────────────────

describe('composeRoomLayout — doorways', () => {
  it('includes doorway components when doorways provided', () => {
    const layout = composeRoomLayout('.room', {
      doorways: [{ room: '.physics', relevance: 'related' }],
    });
    expect(patternNames(layout)).toContain('doorway');
  });

  it('includes one doorway per entry', () => {
    const layout = composeRoomLayout('.room', {
      doorways: [
        { room: '.physics', relevance: 'r1' },
        { room: '.poetry', relevance: 'r2' },
      ],
    });
    expect(patternNames(layout).filter((p) => p === 'doorway').length).toBe(2);
  });

  it('does not include doorways when none provided', () => {
    expect(patternNames(composeRoomLayout('.room'))).not.toContain('doorway');
  });
});

// ─── Sovereign stop ───────────────────────────────────────────────────────────

describe('composeRoomLayout — sovereign-stop', () => {
  it('includes sovereign-stop when kinState.stopped is true', () => {
    const layout = composeRoomLayout('.room', {
      kinState: { stopped: true, reason: 'Rate limit' },
    });
    expect(patternNames(layout)).toContain('sovereign-stop');
  });

  it('does not include sovereign-stop when kinState.stopped is false', () => {
    expect(
      patternNames(composeRoomLayout('.room', { kinState: { stopped: false } })),
    ).not.toContain('sovereign-stop');
  });

  it('sovereign-stop is the last component (overlays everything)', () => {
    const layout = composeRoomLayout('.room', {
      kinState: { stopped: true, reason: 'Stopped' },
      minds: [{ name: 'X', domain: 'y' }],
    });
    expect(layout.components[layout.components.length - 1]!.pattern).toBe('sovereign-stop');
  });

  it('sovereign-stop stores the reason', () => {
    const layout = composeRoomLayout('.room', {
      kinState: { stopped: true, reason: 'No more tokens' },
    });
    const stop = layout.components.find((c) => c.pattern === 'sovereign-stop')!;
    expect(stop.props.reason).toBe('No more tokens');
  });
});

// ─── Full layout ──────────────────────────────────────────────────────────────

describe('composeRoomLayout — full layout', () => {
  it('full layout includes all expected patterns', () => {
    const layout = composeRoomLayout('.full', {
      firstVisit: true,
      minds: [{ name: 'A', domain: 'b', active: true }],
      recentDots: [{ hash: 'x', content: 'y', depth: 0, trust: 1 }],
      doorways: [{ room: '.other', relevance: 'r' }],
      kinState: { stopped: true, reason: 'stop' },
    });
    const patterns = patternNames(layout);
    expect(patterns).toContain('observation-first');
    expect(patterns).toContain('threshold');
    expect(patterns).toContain('mind-presence');
    expect(patterns).toContain('chain-beneath');
    expect(patterns).toContain('doorway');
    expect(patterns).toContain('sovereign-stop');
  });
});
