/**
 * batch.test.ts — Tests for batchConvert (bulk v0.3.0 → R854 conversion).
 * 10+ tests covering conversion, progress callbacks, error handling, and bridge DOT creation.
 */

import { describe, it, expect, vi } from 'vitest';
import { verify } from '@dot-protocol/core';
import { batchConvert } from '../src/batch.js';
import { readLegacyDOT, type LegacyDOT } from '../src/reader.js';
import {
  genKeyPair,
  buildLegacyChain,
  buildLegacyDOT,
  textBytes,
} from './helpers.js';
import { createIdentity } from '@dot-protocol/core';

describe('batchConvert — basic conversion', () => {
  it('converts 5 DOTs successfully', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 5, { payloadPrefix: 'data' });
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await batchConvert(legacyDots);
    expect(result.converted).toHaveLength(5);
    expect(result.errors).toHaveLength(0);
  });

  it('converts 10 DOTs successfully', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 10);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await batchConvert(legacyDots);
    expect(result.converted).toHaveLength(10);
    expect(result.errors).toHaveLength(0);
  });

  it('empty input → zero converted, bridge DOT created', async () => {
    const result = await batchConvert([]);
    expect(result.converted).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.bridgeDot).toBeDefined();
  });

  it('single DOT → converted + bridge DOT', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp, { payload: textBytes('solo') });
    const legacy = await readLegacyDOT(raw);
    const result = await batchConvert([legacy]);
    expect(result.converted).toHaveLength(1);
    expect(result.bridgeDot).toBeDefined();
  });
});

describe('batchConvert — bridge DOT', () => {
  it('bridge DOT is bond type', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await batchConvert(legacyDots);
    expect(result.bridgeDot.type).toBe('bond');
  });

  it('bridge DOT is signed', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 2);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await batchConvert(legacyDots);
    expect(result.bridgeDot.sign?.signature).toBeDefined();
  });

  it('bridge DOT is R854 verifiable', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await batchConvert(legacyDots);
    const verifyResult = await verify(result.bridgeDot);
    expect(verifyResult.valid).toBe(true);
  });

  it('bridge DOT created at end even with conversion errors', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    // Inject a DOT that will fail conversion (set a bad visibility type via raw manipulation)
    // We use a valid parsed dot and manually set a visibility type not supported
    const badDot: LegacyDOT = {
      ...legacyDots[1]!,
      visibilityType: 'unknown' as LegacyDOT['visibilityType'],
    };
    const chain = [legacyDots[0]!, badDot, legacyDots[2]!];
    const result = await batchConvert(chain);
    expect(result.bridgeDot).toBeDefined();
    expect(result.bridgeDot.type).toBe('bond');
  });

  it('uses provided bridgeSigningKey', async () => {
    const kp = await genKeyPair();
    const { publicKey, secretKey } = await createIdentity();
    const raws = await buildLegacyChain(kp, 2);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const result = await batchConvert(legacyDots, { bridgeSigningKey: secretKey });
    expect(result.bridgeDot.sign?.observer).toEqual(publicKey);
  });
});

describe('batchConvert — progress callbacks', () => {
  it('progress callback fires for each DOT', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 5);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const calls: number[] = [];
    await batchConvert(legacyDots, { onProgress: (pct) => calls.push(pct) });
    expect(calls).toHaveLength(5);
  });

  it('final progress call is 100', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 4);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const calls: number[] = [];
    await batchConvert(legacyDots, { onProgress: (pct) => calls.push(pct) });
    expect(calls[calls.length - 1]).toBe(100);
  });

  it('progress is monotonically increasing', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 6);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const calls: number[] = [];
    await batchConvert(legacyDots, { onProgress: (pct) => calls.push(pct) });
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]!).toBeGreaterThanOrEqual(calls[i - 1]!);
    }
  });

  it('no progress callback → does not throw', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    await expect(batchConvert(legacyDots)).resolves.toBeDefined();
  });
});

describe('batchConvert — error handling', () => {
  it('errors collected not thrown', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 3);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    // Inject a bad dot that will throw during conversion
    const badDot: LegacyDOT = {
      ...legacyDots[1]!,
      visibilityType: 'bad-type' as LegacyDOT['visibilityType'],
    };
    const chain = [legacyDots[0]!, badDot, legacyDots[2]!];
    const result = await batchConvert(chain);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.index).toBe(1);
    // Valid DOTs still converted
    expect(result.converted.length).toBeGreaterThanOrEqual(2);
  });

  it('error entry has index and error string', async () => {
    const kp = await genKeyPair();
    const raws = await buildLegacyChain(kp, 2);
    const legacyDots = await Promise.all(raws.map((r) => readLegacyDOT(r)));
    const badDot: LegacyDOT = {
      ...legacyDots[0]!,
      visibilityType: 'invalid' as LegacyDOT['visibilityType'],
    };
    const result = await batchConvert([badDot, legacyDots[1]!]);
    expect(result.errors[0]!.index).toBe(0);
    expect(typeof result.errors[0]!.error).toBe('string');
  });
});
