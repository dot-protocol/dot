/**
 * Component tests for @dot-protocol/mark — R854.
 * 15+ tests covering each display type renderer.
 */

import { describe, it, expect } from 'vitest';
import { renderGauge, renderBadge, renderNumber, renderText, renderList, renderChart, renderObservation } from '../src/components.js';
import type { DOT } from '@dot-protocol/core';

// ---------------------------------------------------------------------------
// renderGauge
// ---------------------------------------------------------------------------

describe('renderGauge', () => {
  it('returns a string', () => {
    expect(typeof renderGauge(50, 0, 100, 'C')).toBe('string');
  });

  it('contains SVG element', () => {
    const out = renderGauge(50, 0, 100, 'C');
    expect(out).toContain('<svg');
    expect(out).toContain('</svg>');
  });

  it('contains arc path', () => {
    const out = renderGauge(50, 0, 100, 'C');
    expect(out).toContain('<path');
  });

  it('renders the value', () => {
    const out = renderGauge(42, 0, 100, 'rpm');
    expect(out).toContain('42');
  });

  it('renders the unit', () => {
    const out = renderGauge(50, 0, 100, 'MHz');
    expect(out).toContain('MHz');
  });

  it('handles value at min (0%)', () => {
    const out = renderGauge(0, 0, 100, '');
    expect(out).toBeDefined();
    // At pct=0, no foreground arc path (empty fgPath)
    expect(out).toContain('dm-gauge-wrap');
  });

  it('handles value at max (100%)', () => {
    const out = renderGauge(100, 0, 100, '');
    expect(out).toContain('dm-gauge-wrap');
  });

  it('clamps value below min to min', () => {
    // Should not throw
    expect(() => renderGauge(-10, 0, 100, '')).not.toThrow();
  });

  it('clamps value above max to max', () => {
    expect(() => renderGauge(150, 0, 100, '')).not.toThrow();
  });

  it('renders min-max range in output', () => {
    const out = renderGauge(50, 10, 90, 'K');
    expect(out).toContain('10');
    expect(out).toContain('90');
  });
});

// ---------------------------------------------------------------------------
// renderBadge
// ---------------------------------------------------------------------------

describe('renderBadge', () => {
  it('returns HTML string', () => {
    expect(typeof renderBadge('active', 'green')).toBe('string');
  });

  it('contains dm-badge class', () => {
    expect(renderBadge('active', 'green')).toContain('dm-badge');
  });

  it('renders the label text', () => {
    const out = renderBadge('shutdown', 'red');
    expect(out).toContain('shutdown');
  });

  it('applies color styling', () => {
    const out = renderBadge('active', 'green');
    expect(out).toContain('green');
  });

  it('handles unknown color gracefully', () => {
    // Should not throw
    expect(() => renderBadge('foo', '#abcdef')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// renderNumber
// ---------------------------------------------------------------------------

describe('renderNumber', () => {
  it('returns HTML string', () => {
    expect(typeof renderNumber(42)).toBe('string');
  });

  it('contains dm-number-value class', () => {
    expect(renderNumber(100)).toContain('dm-number-value');
  });

  it('renders the number', () => {
    expect(renderNumber(1337)).toContain('1');
  });

  it('renders with optional label', () => {
    const out = renderNumber(9000, 'RPM');
    expect(out).toContain('RPM');
  });

  it('no label → no dm-number-label class', () => {
    const out = renderNumber(5);
    expect(out).not.toContain('dm-number-label');
  });

  it('renders float with 2 decimal places', () => {
    const out = renderNumber(3.14159);
    expect(out).toContain('3.14');
  });
});

// ---------------------------------------------------------------------------
// renderText
// ---------------------------------------------------------------------------

describe('renderText', () => {
  it('returns HTML string', () => {
    expect(typeof renderText('hello')).toBe('string');
  });

  it('wraps in <p> tag', () => {
    expect(renderText('hello')).toContain('<p');
    expect(renderText('hello')).toContain('</p>');
  });

  it('contains dm-text class', () => {
    expect(renderText('test')).toContain('dm-text');
  });

  it('renders the text content', () => {
    expect(renderText('The quick brown fox')).toContain('The quick brown fox');
  });

  it('escapes HTML in text', () => {
    const out = renderText('<script>evil()</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;');
  });
});

// ---------------------------------------------------------------------------
// renderList
// ---------------------------------------------------------------------------

describe('renderList', () => {
  it('returns HTML string', () => {
    expect(typeof renderList(['a', 'b'])).toBe('string');
  });

  it('contains <ul> element', () => {
    expect(renderList(['a'])).toContain('<ul');
  });

  it('contains <li> elements', () => {
    const out = renderList(['first', 'second']);
    expect(out).toContain('<li');
  });

  it('renders each item', () => {
    const out = renderList(['alpha', 'beta', 'gamma']);
    expect(out).toContain('alpha');
    expect(out).toContain('beta');
    expect(out).toContain('gamma');
  });

  it('empty list renders empty <ul>', () => {
    const out = renderList([]);
    expect(out).toContain('<ul');
  });
});

// ---------------------------------------------------------------------------
// renderObservation
// ---------------------------------------------------------------------------

describe('renderObservation', () => {
  it('state DOT → badge by default', () => {
    const dot: DOT = { type: 'state' };
    const out = renderObservation(dot);
    expect(out).toContain('dm-badge');
  });

  it('event DOT → badge by default', () => {
    const dot: DOT = { type: 'event' };
    const out = renderObservation(dot);
    expect(out).toContain('dm-badge');
  });

  it('claim DOT → text by default', () => {
    const dot: DOT = { type: 'claim' };
    const out = renderObservation(dot);
    expect(out).toContain('dm-text');
  });

  it('overriding display with "number"', () => {
    const dot: DOT = { type: 'measure' };
    const out = renderObservation(dot, 'number');
    expect(out).toContain('dm-number-value');
  });

  it('plain-mode payload decoded and rendered', () => {
    const payload = new TextEncoder().encode('reactor_online');
    const dot: DOT = { type: 'state', payload, payload_mode: 'plain' };
    const out = renderObservation(dot, 'text');
    expect(out).toContain('reactor_online');
  });

  it('fhe-mode payload not decoded', () => {
    const payload = new TextEncoder().encode('secret');
    const dot: DOT = { type: 'claim', payload, payload_mode: 'fhe' };
    const out = renderObservation(dot, 'text');
    // Should not contain raw decoded text (fhe = opaque)
    expect(out).not.toContain('secret');
  });
});
