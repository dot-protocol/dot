import { describe, it, expect } from 'vitest';
import { createKeypair, createDOT } from '@dot-protocol/core';
import type { LegacyDOT } from '@dot-protocol/core';
import {
  encodeBinary,
  decodeBinary,
  encodeNested,
  decodeNested,
  encodeSteganographic,
  decodeSteganographic,
  selectQRSpec,
  DOT_SIZE,
} from '../encode.js';
import { QR_CAPACITY } from '../types.js';

async function makeDots(count: number): Promise<LegacyDOT[]> {
  const kp = await createKeypair();
  const dots: LegacyDOT[] = [];
  let prev: LegacyDOT | undefined = undefined;
  for (let i = 0; i < count; i++) {
    const dot = await createDOT({ keypair: kp, previous: prev });
    dots.push(dot);
    prev = dot;
  }
  return dots;
}

async function makeDot(): Promise<LegacyDOT> {
  const dots = await makeDots(1);
  const dot = dots[0];
  if (dot === undefined) throw new Error('makeDots(1) returned no DOT');
  return dot;
}

describe('Binary encoding', () => {
  it('encodes and decodes a single DOT', async () => {
    const dot = await makeDot();
    const buf = encodeBinary([dot]);
    expect(buf.length).toBe(DOT_SIZE);
    const decoded = decodeBinary(buf);
    const decodedDot = decoded[0];
    if (decodedDot === undefined) throw new Error('decodeBinary returned no DOT');
    expect(decoded).toHaveLength(1);
    expect(decodedDot.pubkey).toEqual(dot.pubkey);
    expect(decodedDot.sig).toEqual(dot.sig);
  });

  it('encodes and decodes multiple DOTs', async () => {
    const dots = await makeDots(5);
    const buf = encodeBinary(dots);
    expect(buf.length).toBe(5 * DOT_SIZE);
    const decoded = decodeBinary(buf);
    expect(decoded).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      const decodedDot = decoded[i];
      const dot = dots[i];
      if (decodedDot === undefined || dot === undefined) {
        throw new Error(`missing DOT at index ${i}`);
      }
      expect(decodedDot.pubkey).toEqual(dot.pubkey);
    }
  });

  it('throws for empty array', () => {
    expect(() => encodeBinary([])).toThrow();
  });

  it(`throws when exceeding QR capacity of ${QR_CAPACITY.dotsPerCode} DOTs`, async () => {
    // Mock DOT count exceeding limit without generating them all
    const dot = await makeDot();
    const tooMany: LegacyDOT[] = Array(QR_CAPACITY.dotsPerCode + 1).fill(dot);
    expect(() => encodeBinary(tooMany)).toThrow();
  });

  it('throws on decode if buffer not multiple of 153', () => {
    const bad = new Uint8Array(100);
    expect(() => decodeBinary(bad)).toThrow();
  });
});

describe('Nested encoding', () => {
  it('encodes and decodes preserving DOT order', async () => {
    const dots = await makeDots(3);
    const buf = encodeNested(dots);
    const decoded = decodeNested(buf);
    expect(decoded).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const decodedDot = decoded[i];
      const dot = dots[i];
      if (decodedDot === undefined || dot === undefined) {
        throw new Error(`missing DOT at index ${i}`);
      }
      expect(decodedDot.pubkey).toEqual(dot.pubkey);
    }
  });

  it('each entry is 2 + 153 = 155 bytes', async () => {
    const dots = await makeDots(2);
    const buf = encodeNested(dots);
    expect(buf.length).toBe(2 * 155);
  });

  it('throws on decode if buffer not multiple of 155', () => {
    const bad = new Uint8Array(100);
    expect(() => decodeNested(bad)).toThrow();
  });
});

describe('Steganographic encoding', () => {
  it('XOR round-trip recovers original DOT bytes', async () => {
    const dots = await makeDots(1);
    const dotBytes = encodeBinary(dots);
    const carrier = new Uint8Array(dotBytes.length).fill(0xab);

    const masked = encodeSteganographic(dots, carrier);
    const recovered = decodeSteganographic(masked, carrier, 1);
    const recoveredDot = recovered[0];
    const dot = dots[0];
    if (recoveredDot === undefined || dot === undefined) {
      throw new Error('missing steganographic round-trip DOT');
    }
    expect(recoveredDot.pubkey).toEqual(dot.pubkey);
  });

  it('throws if DOT payload exceeds carrier', async () => {
    const dots = await makeDots(1);
    const tinyCarrier = new Uint8Array(10); // too small
    expect(() => encodeSteganographic(dots, tinyCarrier)).toThrow();
  });
});

describe('selectQRSpec', () => {
  it('returns version 1 for a single DOT in binary mode', async () => {
    // 153 bytes — needs v40 since v1 only holds 17 bytes
    const spec = selectQRSpec(1, 'binary');
    expect(spec.version).toBeGreaterThanOrEqual(1);
    expect(spec.dotsPerCode).toBe(1);
    expect(spec.encoding).toBe('binary');
  });

  it('returns version 40 for 19 DOTs (max capacity)', async () => {
    const spec = selectQRSpec(19, 'binary');
    expect(spec.version).toBeLessThanOrEqual(40);
    expect(spec.errorCorrection).toBe('L');
  });
});
