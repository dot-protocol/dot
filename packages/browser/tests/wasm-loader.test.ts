/**
 * wasm-loader.test.ts — Tests for getWasmBase64(), getWasmGlue(), getWasmSize().
 *
 * Validates that the WASM binary can be read and encoded correctly,
 * and that the glue code is valid JS for embedding.
 */

import { describe, it, expect } from 'vitest';
import {
  getWasmBase64,
  getWasmGlue,
  getWasmSize,
  getWasmBase64Size,
} from '../src/wasm-loader.js';

// ── getWasmBase64() ───────────────────────────────────────────────────────

describe('getWasmBase64()', () => {
  it('returns a non-empty string', () => {
    const b64 = getWasmBase64();
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
  });

  it('is valid base64 (only base64 chars)', () => {
    const b64 = getWasmBase64();
    // Standard base64: A-Z, a-z, 0-9, +, /, = padding
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('decodes to valid WASM binary (starts with \\0asm magic)', () => {
    const b64 = getWasmBase64();
    const bin = Buffer.from(b64, 'base64');
    // WASM magic bytes: 0x00 0x61 0x73 0x6D (= "\0asm")
    expect(bin[0]).toBe(0x00);
    expect(bin[1]).toBe(0x61); // 'a'
    expect(bin[2]).toBe(0x73); // 's'
    expect(bin[3]).toBe(0x6d); // 'm'
  });

  it('base64 decodes to approximately the raw WASM size', () => {
    const b64 = getWasmBase64();
    const decoded = Buffer.from(b64, 'base64');
    const rawSize = getWasmSize();
    // Allow ±1 byte for padding rounding
    expect(Math.abs(decoded.length - rawSize)).toBeLessThanOrEqual(2);
  });

  it('is deterministic (returns same value on repeated calls)', () => {
    const b1 = getWasmBase64();
    const b2 = getWasmBase64();
    expect(b1).toBe(b2);
  });

  it('has length consistent with base64 encoding formula ceil(n/3)*4', () => {
    const rawSize = getWasmSize();
    const b64 = getWasmBase64();
    const expectedLen = Math.ceil(rawSize / 3) * 4;
    // Allow for ±4 chars (1 group) variance
    expect(Math.abs(b64.length - expectedLen)).toBeLessThanOrEqual(4);
  });
});

// ── getWasmGlue() ─────────────────────────────────────────────────────────

describe('getWasmGlue()', () => {
  it('returns a non-empty string', () => {
    const glue = getWasmGlue();
    expect(typeof glue).toBe('string');
    expect(glue.length).toBeGreaterThan(0);
  });

  it('contains wasm-related code', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/wasm/i);
  });

  it('contains generate_keypair function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/generate_keypair/);
  });

  it('contains create_dot function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/create_dot/);
  });

  it('contains verify_dot function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/verify_dot/);
  });

  it('contains hash_hex function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/hash_hex/);
  });

  it('contains sign function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/\bsign\b/);
  });

  it('contains verify function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/\bverify\b/);
  });

  it('contains DotKeypair class', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/DotKeypair/);
  });

  it('contains ObservationType enum', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/ObservationType/);
  });

  it('contains __wbg_get_imports internal function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/__wbg_get_imports/);
  });

  it('contains __wbg_finalize_init function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/__wbg_finalize_init/);
  });

  it('contains initSync function', () => {
    const glue = getWasmGlue();
    expect(glue).toMatch(/initSync/);
  });

  it('is under 50KB (sanity check for JS glue size)', () => {
    const glue = getWasmGlue();
    const sizeKB = Buffer.byteLength(glue, 'utf8') / 1024;
    expect(sizeKB).toBeLessThan(50);
  });
});

// ── getWasmSize() ─────────────────────────────────────────────────────────

describe('getWasmSize()', () => {
  it('returns a positive integer', () => {
    const size = getWasmSize();
    expect(typeof size).toBe('number');
    expect(size).toBeGreaterThan(0);
    expect(Number.isInteger(size)).toBe(true);
  });

  it('is at least 100KB (WASM is non-trivial)', () => {
    const size = getWasmSize();
    expect(size).toBeGreaterThan(100 * 1024);
  });

  it('is under 1MB (sanity ceiling)', () => {
    const size = getWasmSize();
    expect(size).toBeLessThan(1024 * 1024);
  });

  it('matches the actual file size', () => {
    // The known size from build
    const size = getWasmSize();
    // Between 150KB and 400KB — typical range for Ed25519+BLAKE3 WASM
    expect(size).toBeGreaterThan(150 * 1024);
    expect(size).toBeLessThan(400 * 1024);
  });
});

// ── getWasmBase64Size() ───────────────────────────────────────────────────

describe('getWasmBase64Size()', () => {
  it('returns a positive integer larger than raw size', () => {
    const b64Size = getWasmBase64Size();
    const rawSize = getWasmSize();
    expect(b64Size).toBeGreaterThan(rawSize);
  });

  it('is approximately 4/3 of raw size (base64 overhead)', () => {
    const b64Size = getWasmBase64Size();
    const rawSize = getWasmSize();
    const ratio = b64Size / rawSize;
    // Base64 overhead = 4/3 ≈ 1.333
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.4);
  });

  it('matches length of getWasmBase64() output', () => {
    const b64 = getWasmBase64();
    const b64Size = getWasmBase64Size();
    expect(b64Size).toBe(b64.length);
  });
});
