/**
 * integrity.test.ts — DotFS integrity and tampering detection tests.
 *
 * 20+ tests: tamper file content → detected, tamper sidecar → detected,
 * missing sidecar → graceful.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { DotFS } from '../src/dotfs.js';
import { MemoryFSBackend } from '../src/backends/memory.js';
import { sidecarPath } from '../src/sidecar.js';
import { checkIntegrity, detectTampering, createTamperingEventDOT } from '../src/integrity.js';

let backend: MemoryFSBackend;
let dotfs: DotFS;

beforeEach(async () => {
  backend = new MemoryFSBackend();
  const identity = await createIdentity();
  dotfs = new DotFS(backend, identity);
});

// ─── dotfs.verify ─────────────────────────────────────────────────────────────

describe('verify — clean file', () => {
  it('valid = true for unmodified file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('clean'));
    const result = await dotfs.verify('/file.txt');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('valid = true for file with multiple writes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const result = await dotfs.verify('/file.txt');
    expect(result.valid).toBe(true);
  });
});

describe('verify — file does not exist', () => {
  it('returns valid=false for nonexistent file', async () => {
    const result = await dotfs.verify('/nonexistent.txt');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('does not exist'))).toBe(true);
  });
});

describe('verify — missing sidecar', () => {
  it('valid = false when sidecar missing', async () => {
    backend.writeFile('/raw.txt', new TextEncoder().encode('raw'));
    const result = await dotfs.verify('/raw.txt');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sidecar'))).toBe(true);
  });
});

describe('verify — tampered file content', () => {
  it('detects content tampering', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered'));
    const result = await dotfs.verify('/file.txt');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('hash') || e.includes('tamper'))).toBe(true);
  });

  it('error message mentions content hash mismatch', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('MODIFIED'));
    const result = await dotfs.verify('/file.txt');
    expect(result.errors).toContain('content hash mismatch — file may be tampered');
  });

  it('partial tampering (one byte) is detected', async () => {
    const content = new Uint8Array(50).fill(0x61);
    await dotfs.write('/file.bin', content);
    const tampered = new Uint8Array(content);
    tampered[25] = 0x62;
    backend.writeFile('/file.bin', tampered);
    const result = await dotfs.verify('/file.bin');
    expect(result.valid).toBe(false);
  });
});

describe('verify — tampered sidecar', () => {
  it('corrupted sidecar records → graceful, errors reported', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    // Corrupt sidecar
    backend.writeFile(sidecarPath('/file.txt'), new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    const result = await dotfs.verify('/file.txt');
    // Sidecar corruption means empty chain → sidecar is empty
    expect(result.valid).toBe(false);
  });

  it('empty sidecar → valid=false', async () => {
    backend.writeFile('/file.txt', new TextEncoder().encode('hello'));
    backend.writeFile(sidecarPath('/file.txt'), new Uint8Array(0));
    const result = await dotfs.verify('/file.txt');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sidecar is empty'))).toBe(true);
  });
});

// ─── checkIntegrity ───────────────────────────────────────────────────────────

describe('checkIntegrity', () => {
  it('returns IntegrityReport with path', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('test'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.path).toBe('/file.txt');
  });

  it('valid = true for clean file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('test'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.valid).toBe(true);
  });

  it('contentHashValid = true for clean file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('test'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.contentHashValid).toBe(true);
  });

  it('signaturesValid = true for clean file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('test'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.signaturesValid).toBe(true);
  });

  it('chainValid = true for clean file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('test'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.chainValid).toBe(true);
  });

  it('chainDepth matches number of writes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v3'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.chainDepth).toBe(3);
  });

  it('contentHashValid = false when file tampered', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered'));
    const report = await checkIntegrity(dotfs, '/file.txt');
    expect(report.contentHashValid).toBe(false);
  });

  it('checkedAt is a recent timestamp', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('test'));
    const before = Date.now();
    const report = await checkIntegrity(dotfs, '/file.txt');
    const after = Date.now();
    expect(report.checkedAt).toBeGreaterThanOrEqual(before);
    expect(report.checkedAt).toBeLessThanOrEqual(after);
  });
});

// ─── detectTampering ──────────────────────────────────────────────────────────

describe('detectTampering', () => {
  it('tampered = false for clean file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('clean'));
    const result = await detectTampering(dotfs, '/file.txt');
    expect(result.tampered).toBe(false);
  });

  it('tampered = true for modified file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered!'));
    const result = await detectTampering(dotfs, '/file.txt');
    expect(result.tampered).toBe(true);
  });

  it('returns expected and actual hex hashes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered!'));
    const result = await detectTampering(dotfs, '/file.txt');
    expect(result.expected).toMatch(/^[0-9a-f]{64}$/);
    expect(result.actual).toMatch(/^[0-9a-f]{64}$/);
    expect(result.expected).not.toBe(result.actual);
  });

  it('expected and actual match for clean file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('clean'));
    const result = await detectTampering(dotfs, '/file.txt');
    expect(result.expected).toBe(result.actual);
  });

  it('file with no sidecar → tampered = false (cannot determine)', async () => {
    backend.writeFile('/raw.txt', new TextEncoder().encode('raw'));
    const result = await detectTampering(dotfs, '/raw.txt');
    expect(result.tampered).toBe(false);
    expect(result.expected).toBe('');
  });
});

// ─── createTamperingEventDOT ──────────────────────────────────────────────────

describe('createTamperingEventDOT', () => {
  it('returns a DOT', () => {
    const dot = createTamperingEventDOT('/file.txt', 'abc', 'def');
    expect(dot).toBeDefined();
    expect(dot.payload).toBeDefined();
  });

  it('event type is event', () => {
    const dot = createTamperingEventDOT('/file.txt', 'abc', 'def');
    expect(dot.type).toBe('event');
  });

  it('payload contains path', () => {
    const dot = createTamperingEventDOT('/secret.txt', 'abc', 'def');
    const payload = new TextDecoder().decode(dot.payload);
    expect(payload).toContain('/secret.txt');
  });

  it('payload contains expected and actual hashes', () => {
    const dot = createTamperingEventDOT('/file.txt', 'expected123', 'actual456');
    const payload = new TextDecoder().decode(dot.payload);
    const parsed = JSON.parse(payload);
    expect(parsed.expected_hash).toBe('expected123');
    expect(parsed.actual_hash).toBe('actual456');
  });

  it('payload contains tampering_detected event', () => {
    const dot = createTamperingEventDOT('/file.txt', 'a', 'b');
    const payload = new TextDecoder().decode(dot.payload);
    const parsed = JSON.parse(payload);
    expect(parsed.event).toBe('tampering_detected');
  });
});
