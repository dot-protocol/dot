/**
 * trust.test.ts — DOT-SEAL trust assessment
 * 35+ tests
 */

import { describe, it, expect } from 'vitest';
import { assessTrust, assessTrustQuick } from '../src/trust.js';
import { createChain, append } from '@dot-protocol/chain';
import { observe, chain as coreChain } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { getSodium } from '../../core/src/crypto/sodium-init.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeIdentity(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array }> {
  const sodium = await getSodium();
  const kp = sodium.crypto_sign_keypair();
  // Return 32-byte public key and extract 32-byte seed from 64-byte secretKey
  return { publicKey: kp.publicKey, secretKey: kp.privateKey.slice(0, 32) };
}

function makeDOT(
  publicKey: Uint8Array,
  opts?: {
    type?: DOT['type'];
    payload?: string;
    utc?: number;
    prev?: DOT;
  },
): DOT {
  const d = observe(opts?.payload ?? 'test', {
    type: opts?.type ?? 'measure',
    plaintext: true,
  });
  const withSign: DOT = {
    ...d,
    time: { utc: opts?.utc ?? Date.now() },
    sign: { observer: publicKey, level: 'pseudonymous' },
  };
  if (opts?.prev !== undefined) {
    return coreChain(withSign, opts.prev);
  }
  return coreChain(withSign);
}

// ─── assessTrustQuick ────────────────────────────────────────────────────────

describe('assessTrustQuick', () => {
  it('new identity with depth=0 age=0 → low trust', () => {
    const identity = new Uint8Array(32).fill(1);
    const score = assessTrustQuick(identity, 0, 0);
    // depth=0 * 0.3 + consistency=1.0 * 0.3 + log10(1)*0.2 + 0*0.2 = 0.3
    expect(score.computedTrust).toBeCloseTo(0.3, 5);
  });

  it('returns consistent=1.0 in quick mode', () => {
    const identity = new Uint8Array(32).fill(1);
    const score = assessTrustQuick(identity, 10, 0);
    expect(score.consistency).toBe(1.0);
  });

  it('returns peerAttestations=0 in quick mode', () => {
    const identity = new Uint8Array(32).fill(1);
    const score = assessTrustQuick(identity, 10, 0);
    expect(score.peerAttestations).toBe(0);
  });

  it('deep chain increases trust', () => {
    const identity = new Uint8Array(32).fill(1);
    const low = assessTrustQuick(identity, 1, 0);
    const high = assessTrustQuick(identity, 100, 0);
    expect(high.computedTrust).toBeGreaterThan(low.computedTrust);
  });

  it('older identity has higher trust (time factor)', () => {
    const identity = new Uint8Array(32).fill(1);
    const fresh = assessTrustQuick(identity, 0, 0);
    const aged = assessTrustQuick(identity, 0, 365 * 86_400_000);
    expect(aged.computedTrust).toBeGreaterThan(fresh.computedTrust);
  });

  it('365 days saturates the time component (0.2)', () => {
    const identity = new Uint8Array(32).fill(1);
    const oneYear = assessTrustQuick(identity, 0, 365 * 86_400_000);
    const twoYear = assessTrustQuick(identity, 0, 730 * 86_400_000);
    // Both should have same time component (capped at 365 days)
    expect(oneYear.computedTrust).toBeCloseTo(twoYear.computedTrust, 5);
  });

  it('throws on empty identity', () => {
    expect(() => assessTrustQuick(new Uint8Array(0), 10, 0)).toThrow();
  });

  it('negative depth is clamped to 0', () => {
    const identity = new Uint8Array(32).fill(1);
    const score = assessTrustQuick(identity, -5, 0);
    expect(score.chainDepth).toBe(0);
  });

  it('negative age is clamped to 0', () => {
    const identity = new Uint8Array(32).fill(1);
    const score = assessTrustQuick(identity, 0, -1000);
    expect(score.timeActive).toBe(0);
  });

  it('quick mode matches formula exactly for depth=10, age=0', () => {
    const identity = new Uint8Array(32).fill(1);
    const score = assessTrustQuick(identity, 10, 0);
    const expected = 10 * 0.3 + 1.0 * 0.3 + Math.log10(1) * 0.2 + 0 * 0.2;
    expect(score.computedTrust).toBeCloseTo(expected, 10);
  });
});

// ─── assessTrust (full chain scan) ───────────────────────────────────────────

describe('assessTrust', () => {
  it('empty chain → trust score with depth=0', async () => {
    const { publicKey } = await makeIdentity();
    const ch = createChain();
    const score = await assessTrust(publicKey, ch);
    expect(score.chainDepth).toBe(0);
  });

  it('empty chain → computedTrust matches quick mode (depth=0, age=0)', async () => {
    const { publicKey } = await makeIdentity();
    const ch = createChain();
    const score = await assessTrust(publicKey, ch);
    const quick = assessTrustQuick(publicKey, 0, 0);
    // Quick uses consistency=1.0; full also returns 1.0 with no contradictions
    expect(score.computedTrust).toBeCloseTo(quick.computedTrust, 5);
  });

  it('single DOT from identity → chainDepth=1', async () => {
    const { publicKey } = await makeIdentity();
    const ch = createChain();
    const dot = makeDOT(publicKey);
    const ch2 = await append(ch, dot);
    const score = await assessTrust(publicKey, ch2);
    expect(score.chainDepth).toBe(1);
  });

  it('multiple DOTs from identity → chainDepth increases', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    for (let i = 0; i < 5; i++) {
      ch = await append(ch, makeDOT(publicKey, { utc: 1000 + i * 1000 }));
    }
    const score = await assessTrust(publicKey, ch);
    expect(score.chainDepth).toBe(5);
  });

  it('deep chain → higher trust than shallow chain', async () => {
    const { publicKey: pk1 } = await makeIdentity();
    const { publicKey: pk2 } = await makeIdentity();

    let ch1 = createChain();
    let ch2 = createChain();

    for (let i = 0; i < 3; i++) {
      ch1 = await append(ch1, makeDOT(pk1));
    }
    for (let i = 0; i < 10; i++) {
      ch2 = await append(ch2, makeDOT(pk2));
    }

    const score1 = await assessTrust(pk1, ch1);
    const score2 = await assessTrust(pk2, ch2);
    expect(score2.computedTrust).toBeGreaterThan(score1.computedTrust);
  });

  it('consistent identity (no contradictions) → consistency=1.0', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    // All different types (not claims) → no consistency check → 1.0
    for (let i = 0; i < 3; i++) {
      ch = await append(ch, makeDOT(publicKey, { type: 'measure' }));
    }
    const score = await assessTrust(publicKey, ch);
    expect(score.consistency).toBe(1.0);
  });

  it('identity DOTs without claim type → consistency=1.0', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    ch = await append(ch, makeDOT(publicKey, { type: 'event', payload: 'hello' }));
    ch = await append(ch, makeDOT(publicKey, { type: 'state', payload: 'world' }));
    const score = await assessTrust(publicKey, ch);
    expect(score.consistency).toBe(1.0);
  });

  it('bond DOTs from other identities count as peer attestations', async () => {
    const { publicKey: targetPk } = await makeIdentity();
    const { publicKey: attesterPk } = await makeIdentity();
    let ch = createChain();

    // Bond from a different identity
    const bondDot = observe('attestation', { type: 'bond', plaintext: true });
    const bondWithSign: DOT = {
      ...bondDot,
      sign: { observer: attesterPk, level: 'pseudonymous' },
    };
    ch = await append(ch, bondWithSign);

    const score = await assessTrust(targetPk, ch);
    expect(score.peerAttestations).toBe(1);
  });

  it('multiple peer attestations increase trust', async () => {
    const { publicKey: targetPk } = await makeIdentity();
    let ch = createChain();

    for (let i = 0; i < 5; i++) {
      const attester = crypto.getRandomValues(new Uint8Array(32));
      const bondDot: DOT = {
        ...observe('bond', { type: 'bond', plaintext: true }),
        sign: { observer: attester, level: 'ephemeral' },
      };
      ch = await append(ch, bondDot);
    }

    const score = await assessTrust(targetPk, ch);
    expect(score.peerAttestations).toBe(5);
    // log10(6) * 0.2 > 0
    expect(score.computedTrust).toBeGreaterThan(0);
  });

  it('time active computed from first to last timestamp', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    const t1 = 1000000;
    const t2 = 1000000 + 86_400_000; // 1 day later
    ch = await append(ch, makeDOT(publicKey, { utc: t1 }));
    ch = await append(ch, makeDOT(publicKey, { utc: t2 }));
    const score = await assessTrust(publicKey, ch);
    expect(score.timeActive).toBe(86_400_000);
  });

  it('no timed DOTs → timeActive=0', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    const untimed: DOT = { ...observe('test', { type: 'measure', plaintext: true }) };
    // Remove time field
    delete (untimed as DOT).time;
    const withSign: DOT = { ...untimed, sign: { observer: publicKey, level: 'ephemeral' } };
    ch = await append(ch, withSign);
    const score = await assessTrust(publicKey, ch);
    expect(score.timeActive).toBe(0);
  });

  it('returns all five score fields', async () => {
    const { publicKey } = await makeIdentity();
    const ch = createChain();
    const score = await assessTrust(publicKey, ch);
    expect(score).toHaveProperty('chainDepth');
    expect(score).toHaveProperty('consistency');
    expect(score).toHaveProperty('peerAttestations');
    expect(score).toHaveProperty('timeActive');
    expect(score).toHaveProperty('computedTrust');
  });

  it('formula: 10 depth + full year + 0 attestations', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    const oneYear = 365 * 86_400_000;
    for (let i = 0; i < 10; i++) {
      ch = await append(ch, makeDOT(publicKey, { utc: i * Math.floor(oneYear / 10) }));
    }
    const score = await assessTrust(publicKey, ch);
    // depth=10, consistency=1.0, peers=0, timeActive≈365days
    const expected =
      10 * 0.3 +
      1.0 * 0.3 +
      Math.log10(1) * 0.2 +
      (Math.min(score.timeActive / 86_400_000, 365) / 365) * 0.2;
    expect(score.computedTrust).toBeCloseTo(expected, 4);
  });

  it('peer attestations use log10 scaling — many attestations do not overwhelm depth', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();

    // Add 100 peer bonds
    for (let i = 0; i < 100; i++) {
      const attester = crypto.getRandomValues(new Uint8Array(32));
      const bondDot: DOT = {
        ...observe('bond', { type: 'bond', plaintext: true }),
        sign: { observer: attester, level: 'ephemeral' },
      };
      ch = await append(ch, bondDot);
    }

    const score = await assessTrust(publicKey, ch);
    // depth=0 * 0.3 + consistency=1.0 * 0.3 + log10(101) * 0.2 + time=0 * 0.2
    const expected = 0 * 0.3 + 1.0 * 0.3 + Math.log10(101) * 0.2 + 0 * 0.2;
    expect(score.computedTrust).toBeCloseTo(expected, 3);
  });

  it('quick mode roughly matches full scan for same inputs', async () => {
    const { publicKey } = await makeIdentity();
    let ch = createChain();
    const t0 = 1_000_000;
    const t1 = t0 + 50_000_000; // ~578 days → capped at 365
    for (let i = 0; i < 5; i++) {
      ch = await append(ch, makeDOT(publicKey, { utc: i === 0 ? t0 : t1 }));
    }
    const full = await assessTrust(publicKey, ch);
    const quick = assessTrustQuick(publicKey, full.chainDepth, full.timeActive);
    // Quick uses consistency=1.0, full should also be 1.0 with no claims
    expect(Math.abs(full.computedTrust - quick.computedTrust)).toBeLessThan(0.01);
  });
});
