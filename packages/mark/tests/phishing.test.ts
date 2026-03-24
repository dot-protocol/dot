/**
 * Phishing detection tests for @dot-protocol/mark — R854.
 * 15+ tests covering risk levels, reasons, warning HTML.
 */

import { describe, it, expect } from 'vitest';
import { checkPhishing, renderPhishingWarning } from '../src/phishing.js';
import type { DOT } from '@dot-protocol/core';

// Helper: create a minimal signed DOT with deep chain (no risk)
function safeDot(): DOT {
  return {
    sign: {
      signature: new Uint8Array(64).fill(1),
      level: 'pseudonymous',
    },
    chain: {
      previous: new Uint8Array(32).fill(1),
      depth: 50,
    },
    time: { utc: Date.now() },
    verify: { hash: new Uint8Array(32).fill(1) },
  };
}

// ---------------------------------------------------------------------------
// checkPhishing — risk levels
// ---------------------------------------------------------------------------

describe('checkPhishing — risk levels', () => {
  it('unsigned DOT → high risk', () => {
    const dot: DOT = {};
    const result = checkPhishing(dot);
    expect(result.risk).toBe('high');
  });

  it('unsigned DOT with chain → still high (no signature)', () => {
    const dot: DOT = { chain: { depth: 100, previous: new Uint8Array(32) } };
    const result = checkPhishing(dot);
    expect(result.risk).toBe('high');
  });

  it('signed DOT with depth 0 → medium', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'anonymous' },
      chain: { depth: 0, previous: new Uint8Array(32) },
    };
    const result = checkPhishing(dot);
    expect(result.risk).toBe('medium');
  });

  it('signed DOT with no chain base → medium', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'anonymous' },
    };
    const result = checkPhishing(dot);
    expect(result.risk).toBe('medium');
  });

  it('signed DOT with ephemeral identity → medium', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'ephemeral' },
      chain: { depth: 50, previous: new Uint8Array(32) },
    };
    const result = checkPhishing(dot);
    expect(result.risk).toBe('medium');
  });

  it('signed DOT with chain depth 3 → low', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'anonymous' },
      chain: { depth: 3, previous: new Uint8Array(32) },
    };
    const result = checkPhishing(dot);
    expect(result.risk).toBe('low');
  });

  it('signed DOT with chain depth 4 → low (< 5)', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'anonymous' },
      chain: { depth: 4, previous: new Uint8Array(32) },
    };
    const result = checkPhishing(dot);
    expect(result.risk).toBe('low');
  });

  it('safe DOT (deep chain, real identity) → none', () => {
    const result = checkPhishing(safeDot());
    expect(result.risk).toBe('none');
  });

  it('safe DOT returns no reasons', () => {
    const result = checkPhishing(safeDot());
    expect(result.reasons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// checkPhishing — reasons
// ---------------------------------------------------------------------------

describe('checkPhishing — reasons', () => {
  it('unsigned DOT includes signature reason', () => {
    const result = checkPhishing({});
    expect(result.reasons.some(r => r.toLowerCase().includes('signature'))).toBe(true);
  });

  it('depth 0 includes chain depth reason', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'anonymous' },
      chain: { depth: 0, previous: new Uint8Array(32) },
    };
    const result = checkPhishing(dot);
    expect(result.reasons.some(r => r.includes('0'))).toBe(true);
  });

  it('ephemeral includes ephemeral reason', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64), level: 'ephemeral' },
      chain: { depth: 50, previous: new Uint8Array(32) },
    };
    const result = checkPhishing(dot);
    expect(result.reasons.some(r => r.toLowerCase().includes('ephemeral'))).toBe(true);
  });

  it('no chain base includes no chain reason', () => {
    const dot: DOT = { sign: { signature: new Uint8Array(64), level: 'real' } };
    const result = checkPhishing(dot);
    expect(result.reasons.some(r => r.toLowerCase().includes('chain'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renderPhishingWarning
// ---------------------------------------------------------------------------

describe('renderPhishingWarning', () => {
  it('risk none → empty string', () => {
    const html = renderPhishingWarning({ risk: 'none', reasons: [] });
    expect(html).toBe('');
  });

  it('high risk → contains high class', () => {
    const html = renderPhishingWarning({ risk: 'high', reasons: ['No signature'] });
    expect(html).toContain('dm-phishing-high');
  });

  it('medium risk → contains medium class', () => {
    const html = renderPhishingWarning({ risk: 'medium', reasons: ['Depth 0'] });
    expect(html).toContain('dm-phishing-medium');
  });

  it('low risk → contains low class', () => {
    const html = renderPhishingWarning({ risk: 'low', reasons: ['Shallow chain'] });
    expect(html).toContain('dm-phishing-low');
  });

  it('warning HTML includes reason text', () => {
    const html = renderPhishingWarning({ risk: 'high', reasons: ['No cryptographic signature'] });
    expect(html).toContain('No cryptographic signature');
  });

  it('high risk warning contains "High Risk" label', () => {
    const html = renderPhishingWarning({ risk: 'high', reasons: [] });
    expect(html).toContain('High Risk');
  });

  it('medium risk warning contains "Medium Risk" label', () => {
    const html = renderPhishingWarning({ risk: 'medium', reasons: [] });
    expect(html).toContain('Medium Risk');
  });
});
