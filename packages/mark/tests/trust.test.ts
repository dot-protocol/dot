/**
 * Trust UI tests for @dot-protocol/mark — R854.
 * 15+ tests covering badge colors, depth labels, bar proportions.
 */

import { describe, it, expect } from 'vitest';
import { trustColor, trustClass, chainDepthLabel, renderTrustBadge, renderTrustBar } from '../src/trust-ui.js';

// ---------------------------------------------------------------------------
// trustColor
// ---------------------------------------------------------------------------

describe('trustColor', () => {
  it('trust 0.0 → red', () => {
    expect(trustColor(0.0)).toBe('#ef4444');
  });

  it('trust 0.1 → red (below 0.3)', () => {
    expect(trustColor(0.1)).toBe('#ef4444');
  });

  it('trust 0.29 → red (just below threshold)', () => {
    expect(trustColor(0.29)).toBe('#ef4444');
  });

  it('trust 0.3 → yellow', () => {
    expect(trustColor(0.3)).toBe('#eab308');
  });

  it('trust 0.5 → yellow', () => {
    expect(trustColor(0.5)).toBe('#eab308');
  });

  it('trust 0.69 → yellow (just below green threshold)', () => {
    expect(trustColor(0.69)).toBe('#eab308');
  });

  it('trust 0.7 → green', () => {
    expect(trustColor(0.7)).toBe('#22c55e');
  });

  it('trust 1.0 → green', () => {
    expect(trustColor(1.0)).toBe('#22c55e');
  });

  it('trust 1.49 → green (just below gold threshold)', () => {
    expect(trustColor(1.49)).toBe('#22c55e');
  });

  it('trust 1.5 → gold', () => {
    expect(trustColor(1.5)).toBe('#f59e0b');
  });

  it('trust 3.0 → gold (high trust)', () => {
    expect(trustColor(3.0)).toBe('#f59e0b');
  });
});

// ---------------------------------------------------------------------------
// trustClass
// ---------------------------------------------------------------------------

describe('trustClass', () => {
  it('0.0 → "red"', () => { expect(trustClass(0.0)).toBe('red'); });
  it('0.3 → "yellow"', () => { expect(trustClass(0.3)).toBe('yellow'); });
  it('0.7 → "green"', () => { expect(trustClass(0.7)).toBe('green'); });
  it('1.5 → "gold"', () => { expect(trustClass(1.5)).toBe('gold'); });
});

// ---------------------------------------------------------------------------
// chainDepthLabel
// ---------------------------------------------------------------------------

describe('chainDepthLabel', () => {
  it('depth 0 → "Genesis"', () => {
    expect(chainDepthLabel(0)).toBe('Genesis');
  });

  it('depth 1 → Shallow', () => {
    expect(chainDepthLabel(1)).toContain('Shallow');
  });

  it('depth 10 → Shallow', () => {
    expect(chainDepthLabel(10)).toContain('Shallow');
  });

  it('depth 11 → Established', () => {
    expect(chainDepthLabel(11)).toContain('Established');
  });

  it('depth 100 → Established', () => {
    expect(chainDepthLabel(100)).toContain('Established');
  });

  it('depth 101 → Deep', () => {
    expect(chainDepthLabel(101)).toContain('Deep');
  });

  it('depth 999 → Deep', () => {
    expect(chainDepthLabel(999)).toContain('Deep');
  });

  it('depth 1000 → Ancient', () => {
    expect(chainDepthLabel(1000)).toContain('Ancient');
  });

  it('depth labels include the depth number', () => {
    expect(chainDepthLabel(42)).toContain('42');
  });
});

// ---------------------------------------------------------------------------
// renderTrustBadge
// ---------------------------------------------------------------------------

describe('renderTrustBadge', () => {
  it('returns a string containing the trust score', () => {
    const badge = renderTrustBadge(0.75, 5);
    expect(badge).toContain('0.75');
  });

  it('badge contains depth label', () => {
    const badge = renderTrustBadge(0.75, 0);
    expect(badge).toContain('Genesis');
  });

  it('badge uses correct color class for red', () => {
    const badge = renderTrustBadge(0.1, 0);
    expect(badge).toContain('dm-trust-red');
  });

  it('badge uses correct color class for gold', () => {
    const badge = renderTrustBadge(2.0, 500);
    expect(badge).toContain('dm-trust-gold');
  });
});

// ---------------------------------------------------------------------------
// renderTrustBar
// ---------------------------------------------------------------------------

describe('renderTrustBar', () => {
  it('trust 0 → width 0%', () => {
    const bar = renderTrustBar(0);
    expect(bar).toContain('width:0%');
  });

  it('trust 2.0 → width 100%', () => {
    const bar = renderTrustBar(2.0);
    expect(bar).toContain('width:100%');
  });

  it('trust > 2.0 capped at 100%', () => {
    const bar = renderTrustBar(3.0);
    expect(bar).toContain('width:100%');
  });

  it('trust 1.0 → 50% width', () => {
    const bar = renderTrustBar(1.0);
    expect(bar).toContain('width:50%');
  });

  it('bar contains background color for trust', () => {
    const bar = renderTrustBar(0.5);
    // yellow (#eab308)
    expect(bar).toContain('#eab308');
  });
});
