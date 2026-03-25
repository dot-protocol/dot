/**
 * negotiation.test.ts — Kin-to-Kin term negotiation tests.
 */

import { describe, it, expect } from 'vitest';
import { proposeTerm, defaultTerms } from '../src/negotiation.js';
import type { NegotiationTerms } from '../src/negotiation.js';

const openTerms: NegotiationTerms = {
  shareIdentity: true,
  shareLocation: true,
  readReceipts: true,
  acceptEphemeral: true,
};

const privateTerms: NegotiationTerms = {
  shareIdentity: false,
  shareLocation: false,
  readReceipts: false,
  acceptEphemeral: false,
};

// ---------------------------------------------------------------------------
// proposeTerm — intersection logic
// ---------------------------------------------------------------------------

describe('proposeTerm — both agree', () => {
  it('both agree on everything → all true', () => {
    const result = proposeTerm(openTerms, openTerms);
    expect(result.shareIdentity).toBe(true);
    expect(result.shareLocation).toBe(true);
    expect(result.readReceipts).toBe(true);
    expect(result.acceptEphemeral).toBe(true);
  });

  it('both refuse everything → all false', () => {
    const result = proposeTerm(privateTerms, privateTerms);
    expect(result.shareIdentity).toBe(false);
    expect(result.shareLocation).toBe(false);
    expect(result.readReceipts).toBe(false);
    expect(result.acceptEphemeral).toBe(false);
  });
});

describe('proposeTerm — one disagrees', () => {
  it('peer refuses shareLocation → not shared', () => {
    const result = proposeTerm(openTerms, { ...openTerms, shareLocation: false });
    expect(result.shareLocation).toBe(false);
    // Other terms still agreed
    expect(result.shareIdentity).toBe(true);
    expect(result.readReceipts).toBe(true);
  });

  it('I refuse readReceipts → not agreed', () => {
    const result = proposeTerm({ ...openTerms, readReceipts: false }, openTerms);
    expect(result.readReceipts).toBe(false);
  });

  it('peer refuses shareIdentity → not shared', () => {
    const result = proposeTerm(openTerms, { ...openTerms, shareIdentity: false });
    expect(result.shareIdentity).toBe(false);
  });

  it('peer refuses acceptEphemeral → not accepted', () => {
    const result = proposeTerm(openTerms, { ...openTerms, acceptEphemeral: false });
    expect(result.acceptEphemeral).toBe(false);
  });
});

describe('proposeTerm — defaults to private', () => {
  it('mixed terms → most private wins per term', () => {
    const mine: NegotiationTerms = {
      shareIdentity: true,
      shareLocation: false,
      readReceipts: true,
      acceptEphemeral: false,
    };
    const peer: NegotiationTerms = {
      shareIdentity: false,
      shareLocation: true,
      readReceipts: false,
      acceptEphemeral: true,
    };
    const result = proposeTerm(mine, peer);
    expect(result.shareIdentity).toBe(false);
    expect(result.shareLocation).toBe(false);
    expect(result.readReceipts).toBe(false);
    expect(result.acceptEphemeral).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defaultTerms
// ---------------------------------------------------------------------------

describe('defaultTerms', () => {
  it('shareIdentity is true by default', () => {
    expect(defaultTerms().shareIdentity).toBe(true);
  });

  it('shareLocation is false by default', () => {
    expect(defaultTerms().shareLocation).toBe(false);
  });

  it('readReceipts is false by default', () => {
    expect(defaultTerms().readReceipts).toBe(false);
  });

  it('acceptEphemeral is true by default', () => {
    expect(defaultTerms().acceptEphemeral).toBe(true);
  });

  it('returns a new object each time (not shared reference)', () => {
    const t1 = defaultTerms();
    const t2 = defaultTerms();
    t1.shareIdentity = false;
    expect(t2.shareIdentity).toBe(true);
  });
});
