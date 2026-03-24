/**
 * read.test.ts — DotFS read operation tests.
 *
 * 30+ tests: read + verify, corrupted content detected,
 * missing sidecar (creates new), binary roundtrip.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { DotFS } from '../src/dotfs.js';
import { MemoryFSBackend } from '../src/backends/memory.js';
import { sidecarPath } from '../src/sidecar.js';

let backend: MemoryFSBackend;
let dotfs: DotFS;

beforeEach(async () => {
  backend = new MemoryFSBackend();
  const identity = await createIdentity();
  dotfs = new DotFS(backend, identity);
});

// ─── Basic read ────────────────────────────────────────────────────────────────

describe('read — basic', () => {
  it('reads back the content written', async () => {
    const content = new TextEncoder().encode('hello world');
    await dotfs.write('/file.txt', content);
    const { content: read } = await dotfs.read('/file.txt');
    expect(new TextDecoder().decode(read)).toBe('hello world');
  });

  it('returns the latest DOT with the content', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    const { dot } = await dotfs.read('/file.txt');
    expect(dot).toBeDefined();
    expect(dot?.sign?.signature).toBeDefined();
  });

  it('verified is true for unmodified file', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    const { verified } = await dotfs.read('/file.txt');
    expect(verified).toBe(true);
  });

  it('returns content even when verified', async () => {
    const content = new TextEncoder().encode('test content');
    await dotfs.write('/file.txt', content);
    const { content: read, verified } = await dotfs.read('/file.txt');
    expect(verified).toBe(true);
    expect(Array.from(read)).toEqual(Array.from(content));
  });

  it('returns the correct dot after multiple writes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const { content } = await dotfs.read('/file.txt');
    expect(new TextDecoder().decode(content)).toBe('v2');
  });

  it('dot has correct chain.depth after two writes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const { dot } = await dotfs.read('/file.txt');
    expect(dot?.chain?.depth).toBe(1);
  });
});

// ─── Missing sidecar ──────────────────────────────────────────────────────────

describe('read — missing sidecar', () => {
  it('reads file that has no sidecar as unverified', async () => {
    // Write directly to backend (bypassing DotFS)
    backend.writeFile('/raw.txt', new TextEncoder().encode('raw content'));
    const { content, dot, verified } = await dotfs.read('/raw.txt');
    expect(new TextDecoder().decode(content)).toBe('raw content');
    expect(dot).toBeUndefined();
    expect(verified).toBe(false);
  });

  it('returns content even without sidecar', async () => {
    backend.writeFile('/raw.txt', new TextEncoder().encode('raw'));
    const { content } = await dotfs.read('/raw.txt');
    expect(new TextDecoder().decode(content)).toBe('raw');
  });

  it('empty sidecar returns unverified', async () => {
    backend.writeFile('/file.txt', new TextEncoder().encode('hello'));
    // Write empty sidecar
    backend.writeFile(sidecarPath('/file.txt'), new Uint8Array(0));
    const { verified } = await dotfs.read('/file.txt');
    expect(verified).toBe(false);
  });
});

// ─── Corruption detection ──────────────────────────────────────────────────────

describe('read — corruption detection', () => {
  it('corrupted content detected: verified = false', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    // Tamper the file directly via backend
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered!'));
    const { verified } = await dotfs.read('/file.txt');
    expect(verified).toBe(false);
  });

  it('corrupted content: still returns the (tampered) content bytes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered!'));
    const { content } = await dotfs.read('/file.txt');
    expect(new TextDecoder().decode(content)).toBe('tampered!');
  });

  it('corrupted content: dot is still returned', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('original'));
    backend.writeFile('/file.txt', new TextEncoder().encode('tampered!'));
    const { dot } = await dotfs.read('/file.txt');
    expect(dot).toBeDefined();
  });

  it('single byte change → detected', async () => {
    const content = new Uint8Array(100).fill(0x41); // all 'A'
    await dotfs.write('/file.bin', content);
    // Change one byte
    const tampered = new Uint8Array(content);
    tampered[50] = 0x42; // 'B'
    backend.writeFile('/file.bin', tampered);
    const { verified } = await dotfs.read('/file.bin');
    expect(verified).toBe(false);
  });

  it('identical content after write → verified', async () => {
    const content = new Uint8Array(100).fill(0x41);
    await dotfs.write('/file.bin', content);
    // Re-write exact same bytes directly (simulating no tampering)
    backend.writeFile('/file.bin', new Uint8Array(content));
    const { verified } = await dotfs.read('/file.bin');
    expect(verified).toBe(true);
  });

  it('corrupted sidecar: graceful, returns unverified', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    // Corrupt the sidecar
    backend.writeFile(sidecarPath('/file.txt'), new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    const { content, verified } = await dotfs.read('/file.txt');
    expect(new TextDecoder().decode(content)).toBe('hello');
    expect(verified).toBe(false);
  });
});

// ─── Binary roundtrip ─────────────────────────────────────────────────────────

describe('read — binary roundtrip', () => {
  it('binary bytes round-trip correctly', async () => {
    const content = new Uint8Array([0, 1, 2, 3, 127, 128, 200, 255]);
    await dotfs.write('/binary.bin', content);
    const { content: read, verified } = await dotfs.read('/binary.bin');
    expect(verified).toBe(true);
    expect(Array.from(read)).toEqual(Array.from(content));
  });

  it('empty file round-trips correctly', async () => {
    await dotfs.write('/empty.txt', new Uint8Array(0));
    const { content, verified } = await dotfs.read('/empty.txt');
    expect(verified).toBe(true);
    expect(content.length).toBe(0);
  });

  it('large binary file round-trips correctly', async () => {
    const content = new Uint8Array(64 * 1024);
    for (let i = 0; i < content.length; i++) content[i] = i % 256;
    await dotfs.write('/large.bin', content);
    const { content: read, verified } = await dotfs.read('/large.bin');
    expect(verified).toBe(true);
    expect(Array.from(read)).toEqual(Array.from(content));
  });

  it('unicode text round-trips correctly', async () => {
    const text = '日本語テスト 🔥 DOT Protocol';
    const content = new TextEncoder().encode(text);
    await dotfs.write('/unicode.txt', content);
    const { content: read, verified } = await dotfs.read('/unicode.txt');
    expect(verified).toBe(true);
    expect(new TextDecoder().decode(read)).toBe(text);
  });

  it('newlines and control characters round-trip correctly', async () => {
    const text = 'line1\nline2\r\nline3\ttabbed';
    const content = new TextEncoder().encode(text);
    await dotfs.write('/lines.txt', content);
    const { content: read, verified } = await dotfs.read('/lines.txt');
    expect(verified).toBe(true);
    expect(new TextDecoder().decode(read)).toBe(text);
  });
});

// ─── Multiple files ────────────────────────────────────────────────────────────

describe('read — multiple files', () => {
  it('reads two different files independently', async () => {
    await dotfs.write('/a.txt', new TextEncoder().encode('file a'));
    await dotfs.write('/b.txt', new TextEncoder().encode('file b'));
    const { content: a } = await dotfs.read('/a.txt');
    const { content: b } = await dotfs.read('/b.txt');
    expect(new TextDecoder().decode(a)).toBe('file a');
    expect(new TextDecoder().decode(b)).toBe('file b');
  });

  it('corrupting one file does not affect verification of another', async () => {
    await dotfs.write('/clean.txt', new TextEncoder().encode('clean'));
    await dotfs.write('/dirty.txt', new TextEncoder().encode('original'));
    backend.writeFile('/dirty.txt', new TextEncoder().encode('tampered'));
    const { verified: cleanOk } = await dotfs.read('/clean.txt');
    const { verified: dirtyOk } = await dotfs.read('/dirty.txt');
    expect(cleanOk).toBe(true);
    expect(dirtyOk).toBe(false);
  });
});
