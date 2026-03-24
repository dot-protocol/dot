/**
 * reader.test.ts — Tests for v0.3.0 153-byte DOT reader.
 * 30+ tests covering parsing, validation, and field extraction.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  readLegacyDOT,
  readLegacyDOTRaw,
  buildLegacySignedBytes,
  trimTrailingZeros,
  isGenesisChainHash,
  LEGACY_DOT_SIZE,
  LEGACY_TYPE_PUBLIC,
  LEGACY_TYPE_CIRCLE,
  LEGACY_TYPE_PRIVATE,
  LEGACY_TYPE_EPHEMERAL,
  type LegacyDOT,
} from '../src/reader.js';
import { genKeyPair, buildLegacyDOT, textBytes, tamperByte, type LegacyKeyPair } from './helpers.js';

describe('readLegacyDOT — size validation', () => {
  it('accepts exactly 153 bytes', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const dot = await readLegacyDOT(raw);
    expect(dot).toBeDefined();
  });

  it('rejects 0 bytes', async () => {
    await expect(readLegacyDOT(new Uint8Array(0))).rejects.toThrow(
      `${LEGACY_DOT_SIZE} bytes`,
    );
  });

  it('rejects 152 bytes (one short)', async () => {
    await expect(readLegacyDOT(new Uint8Array(152))).rejects.toThrow(
      `${LEGACY_DOT_SIZE} bytes`,
    );
  });

  it('rejects 154 bytes (one over)', async () => {
    await expect(readLegacyDOT(new Uint8Array(154))).rejects.toThrow(
      `${LEGACY_DOT_SIZE} bytes`,
    );
  });

  it('rejects 200 bytes', async () => {
    await expect(readLegacyDOT(new Uint8Array(200))).rejects.toThrow(
      `${LEGACY_DOT_SIZE} bytes`,
    );
  });

  it('LEGACY_DOT_SIZE constant is 153', () => {
    expect(LEGACY_DOT_SIZE).toBe(153);
  });
});

describe('readLegacyDOT — field extraction', () => {
  let kp: LegacyKeyPair;
  let raw: Uint8Array;
  let dot: LegacyDOT;

  beforeAll(async () => {
    kp = await genKeyPair();
    raw = await buildLegacyDOT(kp, {
      timestamp: 1700000000000,
      type: LEGACY_TYPE_PUBLIC,
      payload: textBytes('hello'),
    });
    dot = await readLegacyDOT(raw);
  });

  it('pubkey is 32 bytes', () => {
    expect(dot.pubkey).toHaveLength(32);
  });

  it('pubkey matches the keypair public key', () => {
    expect(dot.pubkey).toEqual(kp.publicKey);
  });

  it('signature is 64 bytes', () => {
    expect(dot.signature).toHaveLength(64);
  });

  it('chainHash is 32 bytes', () => {
    expect(dot.chainHash).toHaveLength(32);
  });

  it('timestamp is preserved', () => {
    expect(dot.timestamp).toBe(1700000000000);
  });

  it('visibilityType is public for 0x00', () => {
    expect(dot.visibilityType).toBe('public');
  });

  it('payload trailing zeros stripped', () => {
    const decoded = new TextDecoder().decode(dot.payload);
    expect(decoded).toBe('hello');
    // Not 16 bytes — trailing zeros were trimmed
    expect(dot.payload.length).toBe(5);
  });

  it('raw is the original 153-byte buffer', () => {
    expect(dot.raw).toHaveLength(153);
    expect(dot.raw).toEqual(raw);
  });
});

describe('readLegacyDOT — visibility types', () => {
  let kp: LegacyKeyPair;

  beforeAll(async () => {
    kp = await genKeyPair();
  });

  it('0x00 → public', async () => {
    const raw = await buildLegacyDOT(kp, { type: LEGACY_TYPE_PUBLIC });
    const dot = await readLegacyDOT(raw);
    expect(dot.visibilityType).toBe('public');
  });

  it('0x01 → circle', async () => {
    const raw = await buildLegacyDOT(kp, { type: LEGACY_TYPE_CIRCLE });
    const dot = await readLegacyDOT(raw);
    expect(dot.visibilityType).toBe('circle');
  });

  it('0x02 → private', async () => {
    const raw = await buildLegacyDOT(kp, { type: LEGACY_TYPE_PRIVATE });
    const dot = await readLegacyDOT(raw);
    expect(dot.visibilityType).toBe('private');
  });

  it('0x03 → ephemeral', async () => {
    const raw = await buildLegacyDOT(kp, { type: LEGACY_TYPE_EPHEMERAL });
    const dot = await readLegacyDOT(raw);
    expect(dot.visibilityType).toBe('ephemeral');
  });

  it('0x04 → throws unknown type', async () => {
    const raw = await buildLegacyDOT(kp, { type: 0x00 });
    // Tamper the type byte to 0x04
    const tampered = tamperByte(raw, 136, 0x04);
    // Use readLegacyDOTRaw to bypass signature check, but type check still fires
    expect(() => readLegacyDOTRaw(tampered)).toThrow('Unknown v0.3.0 type byte');
  });
});

describe('readLegacyDOT — payload trimming', () => {
  let kp: LegacyKeyPair;

  beforeAll(async () => {
    kp = await genKeyPair();
  });

  it('empty payload → zero-length bytes', async () => {
    const raw = await buildLegacyDOT(kp, { payload: new Uint8Array(0) });
    const dot = await readLegacyDOT(raw);
    expect(dot.payload.length).toBe(0);
  });

  it('1-byte payload preserved', async () => {
    const raw = await buildLegacyDOT(kp, { payload: new Uint8Array([0x42]) });
    const dot = await readLegacyDOT(raw);
    expect(dot.payload).toEqual(new Uint8Array([0x42]));
  });

  it('full 16-byte payload (no zeros) preserved at 16 bytes', async () => {
    const payload = new Uint8Array(16).fill(0x01);
    const raw = await buildLegacyDOT(kp, { payload });
    const dot = await readLegacyDOT(raw);
    expect(dot.payload.length).toBe(16);
  });

  it('partial payload has trailing zeros stripped', async () => {
    const payload = textBytes('hi'); // 2 bytes + 14 zero bytes
    const raw = await buildLegacyDOT(kp, { payload });
    const dot = await readLegacyDOT(raw);
    expect(dot.payload.length).toBe(2);
    expect(new TextDecoder().decode(dot.payload)).toBe('hi');
  });
});

describe('readLegacyDOT — genesis DOT', () => {
  it('genesis chainHash is 32 zero bytes', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const dot = await readLegacyDOT(raw);
    // Default chainHash is zeros
    const allZero = Array.from(dot.chainHash).every((b) => b === 0);
    expect(allZero).toBe(true);
  });

  it('isGenesisChainHash returns true for genesis', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const dot = await readLegacyDOT(raw);
    expect(isGenesisChainHash(dot.chainHash)).toBe(true);
  });

  it('isGenesisChainHash returns false for non-zero hash', () => {
    const nonZero = new Uint8Array(32).fill(1);
    expect(isGenesisChainHash(nonZero)).toBe(false);
  });
});

describe('readLegacyDOT — signature validation', () => {
  it('valid DOT passes', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    await expect(readLegacyDOT(raw)).resolves.toBeDefined();
  });

  it('tampered pubkey fails', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const tampered = tamperByte(raw, 0, (raw[0]! ^ 0xFF));
    await expect(readLegacyDOT(tampered)).rejects.toThrow(/signature/i);
  });

  it('tampered signature fails', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const tampered = tamperByte(raw, 32, (raw[32]! ^ 0xFF));
    await expect(readLegacyDOT(tampered)).rejects.toThrow(/signature/i);
  });

  it('tampered payload fails', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp, { payload: textBytes('hello') });
    const tampered = tamperByte(raw, 140, 0xFF);
    await expect(readLegacyDOT(tampered)).rejects.toThrow(/signature/i);
  });

  it('tampered timestamp fails', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp, { timestamp: 1700000000000 });
    const tampered = tamperByte(raw, 130, 0xFF);
    await expect(readLegacyDOT(tampered)).rejects.toThrow(/signature/i);
  });
});

describe('buildLegacySignedBytes', () => {
  it('returns 89 bytes (32 pubkey + 57 tail)', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const msg = buildLegacySignedBytes(raw);
    expect(msg).toHaveLength(89);
  });

  it('first 32 bytes are the pubkey', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const msg = buildLegacySignedBytes(raw);
    expect(msg.slice(0, 32)).toEqual(raw.slice(0, 32));
  });

  it('bytes 32–88 are raw[96..152]', async () => {
    const kp = await genKeyPair();
    const raw = await buildLegacyDOT(kp);
    const msg = buildLegacySignedBytes(raw);
    expect(msg.slice(32)).toEqual(raw.slice(96, 153));
  });
});

describe('trimTrailingZeros', () => {
  it('all zeros → empty', () => {
    expect(trimTrailingZeros(new Uint8Array(8))).toHaveLength(0);
  });

  it('no zeros → unchanged', () => {
    const b = new Uint8Array([1, 2, 3]);
    expect(trimTrailingZeros(b)).toEqual(b);
  });

  it('mixed → trims tail zeros only', () => {
    const b = new Uint8Array([1, 0, 2, 0, 0]);
    const result = trimTrailingZeros(b);
    expect(result).toEqual(new Uint8Array([1, 0, 2]));
  });

  it('single zero → empty', () => {
    expect(trimTrailingZeros(new Uint8Array([0]))).toHaveLength(0);
  });

  it('single non-zero → preserved', () => {
    expect(trimTrailingZeros(new Uint8Array([5]))).toEqual(new Uint8Array([5]));
  });
});

describe('readLegacyDOTRaw', () => {
  it('parses without verifying signature', () => {
    const zeros = new Uint8Array(153);
    // No signature check — should not throw on zero bytes for the fields
    const dot = readLegacyDOTRaw(zeros);
    expect(dot.pubkey).toHaveLength(32);
    expect(dot.signature).toHaveLength(64);
  });

  it('still validates size', () => {
    expect(() => readLegacyDOTRaw(new Uint8Array(10))).toThrow(`${LEGACY_DOT_SIZE} bytes`);
  });
});
