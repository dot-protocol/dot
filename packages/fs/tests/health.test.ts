/**
 * health.test.ts — DotFS health reporting tests.
 *
 * 15+ tests: health DOT shape, verification rate tracking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { DotFS } from '../src/dotfs.js';
import { MemoryFSBackend } from '../src/backends/memory.js';
import { health, computeHealth } from '../src/health.js';

let backend: MemoryFSBackend;
let dotfs: DotFS;

beforeEach(async () => {
  backend = new MemoryFSBackend();
  const identity = await createIdentity();
  dotfs = new DotFS(backend, identity);
});

// ─── computeHealth ────────────────────────────────────────────────────────────

describe('computeHealth — empty directory', () => {
  it('totalFiles = 0 for empty dir', async () => {
    backend.mkdir('/empty');
    const stats = await computeHealth(dotfs, '/empty');
    expect(stats.totalFiles).toBe(0);
  });

  it('verificationRate = 1.0 for empty dir (no files to fail)', async () => {
    backend.mkdir('/empty');
    const stats = await computeHealth(dotfs, '/empty');
    expect(stats.verificationRate).toBe(1.0);
  });

  it('deepestChain = 0 for empty dir', async () => {
    backend.mkdir('/empty');
    const stats = await computeHealth(dotfs, '/empty');
    expect(stats.deepestChain).toBe(0);
  });
});

describe('computeHealth — single file', () => {
  it('totalFiles = 1 after one write', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('hello'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.totalFiles).toBe(1);
  });

  it('verifiedCount = 1 for clean file', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('hello'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.verifiedCount).toBe(1);
  });

  it('failedCount = 0 for clean file', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('hello'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.failedCount).toBe(0);
  });

  it('verificationRate = 1.0 for clean file', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('hello'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.verificationRate).toBe(1.0);
  });

  it('deepestChain = 1 after one write', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('hello'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.deepestChain).toBe(1);
  });

  it('deepestChain = 3 after three writes to same file', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/data/file.txt', new TextEncoder().encode('v2'));
    await dotfs.write('/data/file.txt', new TextEncoder().encode('v3'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.deepestChain).toBe(3);
  });

  it('checkedAt is a recent timestamp', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const before = Date.now();
    const stats = await computeHealth(dotfs, '/data');
    const after = Date.now();
    expect(stats.checkedAt).toBeGreaterThanOrEqual(before);
    expect(stats.checkedAt).toBeLessThanOrEqual(after);
  });
});

describe('computeHealth — tampered file', () => {
  it('failedCount = 1 when file is tampered', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/data/file.txt', new TextEncoder().encode('tampered'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.failedCount).toBe(1);
  });

  it('verificationRate = 0.0 when only file is tampered', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/data/file.txt', new TextEncoder().encode('tampered'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.verificationRate).toBe(0.0);
  });

  it('errorPaths contains tampered file path', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/data/file.txt', new TextEncoder().encode('tampered'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.errorPaths.some(p => p.includes('file.txt'))).toBe(true);
  });

  it('mixed: one clean + one tampered → rate = 0.5', async () => {
    await dotfs.write('/data/clean.txt', new TextEncoder().encode('clean'));
    await dotfs.write('/data/dirty.txt', new TextEncoder().encode('original'));
    backend.writeFile('/data/dirty.txt', new TextEncoder().encode('tampered'));
    const stats = await computeHealth(dotfs, '/data');
    expect(stats.verifiedCount).toBe(1);
    expect(stats.failedCount).toBe(1);
    expect(stats.verificationRate).toBe(0.5);
  });
});

// ─── health DOT ───────────────────────────────────────────────────────────────

describe('health DOT', () => {
  it('returns a DOT with payload', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const dot = await health(dotfs, '/data');
    expect(dot).toBeDefined();
    expect(dot.payload).toBeDefined();
  });

  it('health DOT payload is valid JSON', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const dot = await health(dotfs, '/data');
    const payload = new TextDecoder().decode(dot.payload);
    expect(() => JSON.parse(payload)).not.toThrow();
  });

  it('health DOT payload contains totalFiles', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const dot = await health(dotfs, '/data');
    const payload = JSON.parse(new TextDecoder().decode(dot.payload));
    expect(typeof payload.totalFiles).toBe('number');
  });

  it('health DOT payload contains verificationRate', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const dot = await health(dotfs, '/data');
    const payload = JSON.parse(new TextDecoder().decode(dot.payload));
    expect(typeof payload.verificationRate).toBe('number');
  });

  it('health DOT type is state', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const dot = await health(dotfs, '/data');
    expect(dot.type).toBe('state');
  });

  it('health DOT payload_mode is plain', async () => {
    await dotfs.write('/data/file.txt', new TextEncoder().encode('x'));
    const dot = await health(dotfs, '/data');
    expect(dot.payload_mode).toBe('plain');
  });
});
