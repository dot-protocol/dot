/**
 * patterns.test.ts — Tests for the 10 A2UI generative interface patterns.
 * Target: 30+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  threshold,
  revelation,
  mindPresence,
  chainBeneath,
  sovereignStop,
  observationFirst,
  citationTrail,
  doorway,
  ephemeralSurface,
  generativeFace,
  resetIdCounter,
  type UIComponent,
} from '../src/patterns.js';

beforeEach(() => {
  resetIdCounter();
});

// ─── Pattern 1: Threshold ─────────────────────────────────────────────────────

describe('threshold', () => {
  it('returns a UIComponent with pattern "threshold"', () => {
    const c = threshold('What do you seek?');
    expect(c.pattern).toBe('threshold');
  });

  it('has a string id', () => {
    const c = threshold('Hello?');
    expect(typeof c.id).toBe('string');
    expect(c.id.length).toBeGreaterThan(0);
  });

  it('stores the question in props', () => {
    const c = threshold('What brings you here?');
    expect(c.props.question).toBe('What brings you here?');
  });

  it('uses default placeholder when none provided', () => {
    const c = threshold('Hello?');
    expect(c.props.placeholder).toBe('Begin here...');
  });

  it('accepts a custom placeholder', () => {
    const c = threshold('Hello?', 'Type here...');
    expect(c.props.placeholder).toBe('Type here...');
  });

  it('does not have children', () => {
    const c = threshold('Hello?');
    expect(c.children).toBeUndefined();
  });

  it('id includes "threshold"', () => {
    const c = threshold('x');
    expect(c.id).toContain('threshold');
  });
});

// ─── Pattern 2: Revelation ────────────────────────────────────────────────────

describe('revelation', () => {
  const levels = { summary: 'S', detail: 'D', full: 'F' };

  it('returns a UIComponent with pattern "revelation"', () => {
    expect(revelation(levels).pattern).toBe('revelation');
  });

  it('stores all three levels in props', () => {
    const c = revelation(levels);
    expect(c.props.summary).toBe('S');
    expect(c.props.detail).toBe('D');
    expect(c.props.full).toBe('F');
  });

  it('starts at summary level', () => {
    const c = revelation(levels);
    expect(c.props.currentLevel).toBe('summary');
  });

  it('has unique id', () => {
    const a = revelation(levels);
    const b = revelation(levels);
    expect(a.id).not.toBe(b.id);
  });

  it('id contains "revelation"', () => {
    expect(revelation(levels).id).toContain('revelation');
  });
});

// ─── Pattern 3: Mind Presence ─────────────────────────────────────────────────

describe('mindPresence', () => {
  const minds = [
    { name: 'Feynman', domain: 'physics', active: true },
    { name: 'Rumi', domain: 'poetry', active: false },
    { name: 'Shannon', domain: 'information', active: true },
  ];

  it('returns a UIComponent with pattern "mind-presence"', () => {
    expect(mindPresence(minds).pattern).toBe('mind-presence');
  });

  it('stores the minds array in props', () => {
    const c = mindPresence(minds);
    expect(c.props.minds).toEqual(minds);
  });

  it('counts active minds correctly', () => {
    const c = mindPresence(minds);
    expect(c.props.activeCount).toBe(2);
  });

  it('counts total minds correctly', () => {
    const c = mindPresence(minds);
    expect(c.props.totalCount).toBe(3);
  });

  it('handles empty minds array', () => {
    const c = mindPresence([]);
    expect(c.props.totalCount).toBe(0);
    expect(c.props.activeCount).toBe(0);
  });

  it('handles all-inactive minds', () => {
    const inactive = [{ name: 'A', domain: 'x', active: false }];
    expect((mindPresence(inactive).props.activeCount as number)).toBe(0);
  });

  it('id contains "mind-presence"', () => {
    expect(mindPresence(minds).id).toContain('mind-presence');
  });
});

// ─── Pattern 4: Chain Beneath ─────────────────────────────────────────────────

describe('chainBeneath', () => {
  const dots = [
    { hash: 'abc123', content: 'first observation', depth: 0, trust: 0.9 },
    { hash: 'def456', content: 'second observation', depth: 1, trust: 0.75 },
  ];

  it('returns a UIComponent with pattern "chain-beneath"', () => {
    expect(chainBeneath(dots).pattern).toBe('chain-beneath');
  });

  it('stores dots in props', () => {
    const c = chainBeneath(dots);
    expect(c.props.dots).toEqual(dots);
  });

  it('sets tipHash to the last dot hash', () => {
    const c = chainBeneath(dots);
    expect(c.props.tipHash).toBe('def456');
  });

  it('sets chainDepth to the number of dots', () => {
    const c = chainBeneath(dots);
    expect(c.props.chainDepth).toBe(2);
  });

  it('sets tipHash to null for empty chain', () => {
    const c = chainBeneath([]);
    expect(c.props.tipHash).toBeNull();
  });

  it('id contains "chain-beneath"', () => {
    expect(chainBeneath(dots).id).toContain('chain-beneath');
  });
});

// ─── Pattern 5: Sovereign Stop ────────────────────────────────────────────────

describe('sovereignStop', () => {
  it('returns a UIComponent with pattern "sovereign-stop"', () => {
    expect(sovereignStop('Rate limit reached').pattern).toBe('sovereign-stop');
  });

  it('stores the reason in props', () => {
    const c = sovereignStop('Boundary violated');
    expect(c.props.reason).toBe('Boundary violated');
  });

  it('sets stopped to true', () => {
    const c = sovereignStop('reason');
    expect(c.props.stopped).toBe(true);
  });

  it('sets resumeAction to null when not provided', () => {
    const c = sovereignStop('reason');
    expect(c.props.resumeAction).toBeNull();
  });

  it('stores resumeAction when provided', () => {
    const c = sovereignStop('reason', 'Try again');
    expect(c.props.resumeAction).toBe('Try again');
  });

  it('records stoppedAt as a number', () => {
    const before = Date.now();
    const c = sovereignStop('reason');
    const after = Date.now();
    expect(c.props.stoppedAt as number).toBeGreaterThanOrEqual(before);
    expect(c.props.stoppedAt as number).toBeLessThanOrEqual(after);
  });

  it('id contains "sovereign-stop"', () => {
    expect(sovereignStop('reason').id).toContain('sovereign-stop');
  });
});

// ─── Pattern 6: Observation First ────────────────────────────────────────────

describe('observationFirst', () => {
  it('returns a UIComponent with pattern "observation-first"', () => {
    expect(observationFirst().pattern).toBe('observation-first');
  });

  it('uses default placeholder when none given', () => {
    expect(observationFirst().props.placeholder).toBe('What do you observe?');
  });

  it('accepts custom placeholder', () => {
    expect(observationFirst('Tell me...').props.placeholder).toBe('Tell me...');
  });

  it('stores room in props', () => {
    expect(observationFirst(undefined, '.physics').props.room).toBe('.physics');
  });

  it('room is null when not provided', () => {
    expect(observationFirst().props.room).toBeNull();
  });

  it('alwaysVisible is true', () => {
    expect(observationFirst().props.alwaysVisible).toBe(true);
  });

  it('position is "top"', () => {
    expect(observationFirst().props.position).toBe('top');
  });

  it('id contains "observation-first"', () => {
    expect(observationFirst().id).toContain('observation-first');
  });
});

// ─── Pattern 7: Citation Trail ────────────────────────────────────────────────

describe('citationTrail', () => {
  const claims = [
    { text: 'Photons have no mass', source: 'QED, Feynman 1985', confidence: 0.99 },
    { text: 'Information is physical', source: 'Shannon 1948', confidence: 0.95 },
  ];

  it('returns a UIComponent with pattern "citation-trail"', () => {
    expect(citationTrail(claims).pattern).toBe('citation-trail');
  });

  it('stores claims in props', () => {
    const c = citationTrail(claims);
    expect((c.props.claims as typeof claims).length).toBe(2);
  });

  it('clamps confidence above 1 to 1', () => {
    const c = citationTrail([{ text: 'X', source: 'Y', confidence: 1.5 }]);
    expect((c.props.claims as typeof claims)[0]!.confidence).toBe(1);
  });

  it('clamps confidence below 0 to 0', () => {
    const c = citationTrail([{ text: 'X', source: 'Y', confidence: -0.5 }]);
    expect((c.props.claims as typeof claims)[0]!.confidence).toBe(0);
  });

  it('computes avgConfidence correctly', () => {
    const c = citationTrail(claims);
    const avg = (0.99 + 0.95) / 2;
    expect(c.props.avgConfidence as number).toBeCloseTo(avg, 5);
  });

  it('avgConfidence is 0 for empty claims', () => {
    expect(citationTrail([]).props.avgConfidence).toBe(0);
  });

  it('id contains "citation-trail"', () => {
    expect(citationTrail(claims).id).toContain('citation-trail');
  });
});

// ─── Pattern 8: Doorway ───────────────────────────────────────────────────────

describe('doorway', () => {
  it('returns a UIComponent with pattern "doorway"', () => {
    expect(doorway('.physics', 'related topic').pattern).toBe('doorway');
  });

  it('stores targetRoom in props', () => {
    expect(doorway('.physics', 'related').props.targetRoom).toBe('.physics');
  });

  it('stores relevance in props', () => {
    expect(doorway('.physics', 'related to energy').props.relevance).toBe('related to energy');
  });

  it('preview is null when not provided', () => {
    expect(doorway('.physics', 'related').props.preview).toBeNull();
  });

  it('stores preview when provided', () => {
    expect(doorway('.physics', 'related', 'waves and particles').props.preview).toBe(
      'waves and particles',
    );
  });

  it('id contains "doorway"', () => {
    expect(doorway('.x', 'y').id).toContain('doorway');
  });
});

// ─── Pattern 9: Ephemeral Surface ────────────────────────────────────────────

describe('ephemeralSurface', () => {
  it('returns a UIComponent with pattern "ephemeral-surface"', () => {
    expect(ephemeralSurface('hello', 30).pattern).toBe('ephemeral-surface');
  });

  it('stores content in props', () => {
    expect(ephemeralSurface('hello world', 30).props.content).toBe('hello world');
  });

  it('stores ttlSeconds in props', () => {
    expect(ephemeralSurface('x', 60).props.ttlSeconds).toBe(60);
  });

  it('clamps ttlSeconds to minimum of 1', () => {
    expect(ephemeralSurface('x', 0).props.ttlSeconds).toBe(1);
    expect(ephemeralSurface('x', -10).props.ttlSeconds).toBe(1);
  });

  it('sets expiresAt to a future timestamp', () => {
    const before = Date.now();
    const c = ephemeralSurface('x', 30);
    expect(c.props.expiresAt as number).toBeGreaterThan(before);
  });

  it('expiresAt is approximately now + ttl', () => {
    const now = Date.now();
    const c = ephemeralSurface('x', 60);
    expect(c.props.expiresAt as number).toBeCloseTo(now + 60_000, -3);
  });

  it('permanent is true (chain persists)', () => {
    expect(ephemeralSurface('x', 30).props.permanent).toBe(true);
  });

  it('id contains "ephemeral-surface"', () => {
    expect(ephemeralSurface('x', 10).id).toContain('ephemeral-surface');
  });
});

// ─── Pattern 10: Generative Face ─────────────────────────────────────────────

describe('generativeFace', () => {
  const ctx = { language: 'en', expertise: 'expert' };
  const children: UIComponent[] = [observationFirst()];

  it('returns a UIComponent with pattern "generative-face"', () => {
    expect(generativeFace(ctx, children).pattern).toBe('generative-face');
  });

  it('stores humanContext in props', () => {
    const c = generativeFace(ctx, children);
    expect(c.props.humanContext).toEqual(ctx);
  });

  it('stores language in humanContext', () => {
    expect(
      (generativeFace({ language: 'fr', expertise: 'novice' }, []).props.humanContext as typeof ctx).language,
    ).toBe('fr');
  });

  it('stores expertise in humanContext', () => {
    expect(
      (generativeFace(ctx, []).props.humanContext as typeof ctx).expertise,
    ).toBe('expert');
  });

  it('stores children components', () => {
    const c = generativeFace(ctx, children);
    expect(c.children).toHaveLength(1);
  });

  it('works with empty children array', () => {
    const c = generativeFace(ctx, []);
    expect(c.children).toHaveLength(0);
  });

  it('id contains "generative-face"', () => {
    expect(generativeFace(ctx, []).id).toContain('generative-face');
  });
});

// ─── ID uniqueness across patterns ───────────────────────────────────────────

describe('component IDs', () => {
  it('each call produces a unique ID', () => {
    const ids = [
      threshold('a').id,
      threshold('b').id,
      observationFirst().id,
      observationFirst().id,
      doorway('.x', 'y').id,
      doorway('.x', 'y').id,
    ];
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('IDs are non-empty strings', () => {
    const components = [
      threshold('a'),
      revelation({ summary: 's', detail: 'd', full: 'f' }),
      mindPresence([]),
      chainBeneath([]),
      sovereignStop('r'),
      observationFirst(),
      citationTrail([]),
      doorway('.x', 'y'),
      ephemeralSurface('x', 10),
      generativeFace({ language: 'en', expertise: 'novice' }, []),
    ];
    for (const c of components) {
      expect(typeof c.id).toBe('string');
      expect(c.id.length).toBeGreaterThan(0);
    }
  });
});
