/**
 * verify-legacy.test.ts — Tests for v0.3.0 DOT verification.
 * 20+ tests covering signature verification and chain hash linkage.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  verifyLegacy,
  verifyLegacyChain,
  hashLegacyDOT,
} from '../src/verify-legacy.js';
import {
  readLegacyDOT,
  readLegacyDOTRaw,
  type LegacyDOT,
} from '../src/reader.js';
import {
  genKeyPair,
  buildLegacyDOT,
  buildLegacyChain,
  sha256Of,
  tamperByte,
  textBytes,
  type LegacyKeyPair,
} from './helpers.js';

describe('verifyLegacy — single DOT', () => {
  let kp: LegacyKeyPair;

  beforeAll(async () => {
    kp = await genKeyPair();
  });

  it('valid DOT verifies', async () => {
    const raw = await buildLegacyDOT(kp);
    const dot = await readLegacyDOT(raw);
    expect(await verifyLegacy(dot)).toBe(true);
  });

  it('valid DOT with payload verifies', async () => {
    const raw = await buildLegacyDOT(kp, { payload: textBytes('hello') });
    const dot = await readLegacyDOT(raw);
    expect(await verifyLegacy(dot)).toBe(true);
  });

  it('valid DOT with circle type verifies', async () => {
    const raw = await buildLegacyDOT(kp, { type: 0x01 });
    const dot = await readLegacyDOT(raw);
    expect(await verifyLegacy(dot)).toBe(true);
  });

  it('tampered signature byte → false', async () => {
    const raw = await buildLegacyDOT(kp);
    const dot = readLegacyDOTRaw(raw);
    // Directly tamper the signature in the parsed struct
    const badSig = new Uint8Array(dot.signature);
    badSig[0] ^= 0xFF;
    const tamperedDot: LegacyDOT = { ...dot, signature: badSig };
    expect(await verifyLegacy(tamperedDot)).toBe(false);
  });

  it('tampered pubkey → false', async () => {
    const raw = await buildLegacyDOT(kp);
    const dot = readLegacyDOTRaw(raw);
    const badPub = new Uint8Array(dot.pubkey);
    badPub[0] ^= 0xFF;
    const tamperedDot: LegacyDOT = { ...dot, pubkey: badPub };
    expect(await verifyLegacy(tamperedDot)).toBe(false);
  });

  it('wrong raw bytes → false', async () => {
    const raw = await buildLegacyDOT(kp);
    const dot = readLegacyDOTRaw(raw);
    // Tamper the raw buffer at the payload area
    const badRaw = tamperByte(dot.raw, 140, 0xAB);
    const tamperedDot: LegacyDOT = { ...dot, raw: badRaw };
    expect(await verifyLegacy(tamperedDot)).toBe(false);
  });

  it('zeroed signature → false', async () => {
    const raw = await buildLegacyDOT(kp);
    const dot = readLegacyDOTRaw(raw);
    const tamperedDot: LegacyDOT = { ...dot, signature: new Uint8Array(64) };
    expect(await verifyLegacy(tamperedDot)).toBe(false);
  });

  it('wrong keypair signature → false', async () => {
    const kp2 = await genKeyPair();
    const raw = await buildLegacyDOT(kp2);   // signed with kp2
    const dot = readLegacyDOTRaw(raw);
    // Swap pubkey back to kp1 so the signature doesn't match
    const tamperedDot: LegacyDOT = { ...dot, pubkey: kp.publicKey };
    expect(await verifyLegacy(tamperedDot)).toBe(false);
  });
});

describe('hashLegacyDOT', () => {
  it('returns 32 bytes', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const dot = readLegacyDOTRaw(raw);
    expect(hashLegacyDOT(dot)).toHaveLength(32);
  });

  it('matches sha256 of raw bytes', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const dot = readLegacyDOTRaw(raw);
    const expected = sha256Of(raw);
    expect(hashLegacyDOT(dot)).toEqual(expected);
  });

  it('two DOTs with same data have same hash', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp, { timestamp: 1700000000000 });
    const dot = readLegacyDOTRaw(raw);
    const dot2 = readLegacyDOTRaw(raw);
    expect(hashLegacyDOT(dot)).toEqual(hashLegacyDOT(dot2));
  });

  it('different DOTs have different hashes', async () => {
    const kp = await genKeyPair();
    const raw1 = await buildLegacyDOT(kp, { timestamp: 1700000000001 });
    const raw2 = await buildLegacyDOT(kp, { timestamp: 1700000000002 });
    const d1 = readLegacyDOTRaw(raw1);
    const d2 = readLegacyDOTRaw(raw2);
    expect(hashLegacyDOT(d1)).not.toEqual(hashLegacyDOT(d2));
  });
});

describe('verifyLegacyChain', () => {
  it('empty array → valid', async () => {
    const result = await verifyLegacyChain([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('single valid genesis DOT → valid', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const dot = await readLegacyDOT(raw);
    const result = await verifyLegacyChain([dot]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('3-DOT chain with valid links → valid', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3, { payloadPrefix: 'evt' });
    const dots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await verifyLegacyChain(dots);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('5-DOT chain → valid', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 5);
    const dots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await verifyLegacyChain(dots);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('broken chain link detected', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const dots = await Promise.all(raws.map((r) => readLegacyDOT(r)));

    // Break the chain link in DOT[2] by replacing its chainHash
    const brokenDot: LegacyDOT = {
      ...dots[2]!,
      chainHash: new Uint8Array(32).fill(0xAB),
    };
    const chain = [dots[0]!, dots[1]!, brokenDot];
    const result = await verifyLegacyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('DOT[2]'))).toBe(true);
  });

  it('tampered DOT in middle breaks chain at that index', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 4);
    const dots = await Promise.all(raws.map((r) => readLegacyDOT(r)));

    // Replace DOT[1] raw with tampered bytes (breaks sig + chain link from DOT[2])
    const tamperedRaw = tamperByte(dots[1]!.raw, 128, 0xFF);
    const tamperedDot: LegacyDOT = { ...dots[1]!, raw: tamperedRaw };
    const chain = [dots[0]!, tamperedDot, dots[2]!, dots[3]!];
    const result = await verifyLegacyChain(chain);
    expect(result.valid).toBe(false);
    // Should report error at DOT[1] (bad sig) and DOT[2] (bad chain link)
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('collects multiple errors without throwing', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const dots = await Promise.all(raws.map((r) => readLegacyDOT(r)));

    // Break every DOT's signature
    const brokenChain = dots.map((d): LegacyDOT => ({
      ...d,
      signature: new Uint8Array(64),
    }));

    const result = await verifyLegacyChain(brokenChain);
    expect(result.valid).toBe(false);
    // All 3 should report sig errors
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
