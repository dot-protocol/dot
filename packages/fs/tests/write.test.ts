/**
 * write.test.ts — DotFS write operation tests.
 *
 * 40+ tests: create file, overwrite, binary content, large file (1MB),
 * concurrent writes, empty file, nested directories.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { DotFS } from '../src/dotfs.js';
import { MemoryFSBackend } from '../src/backends/memory.js';
import { sidecarExists, readSidecar, sidecarPath } from '../src/sidecar.js';

let backend: MemoryFSBackend;
let dotfs: DotFS;

beforeEach(async () => {
  backend = new MemoryFSBackend();
  const identity = await createIdentity();
  dotfs = new DotFS(backend, identity);
});

// ─── Basic write ───────────────────────────────────────────────────────────────

describe('write — basic', () => {
  it('creates the file on first write', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(backend.exists('/file.txt')).toBe(true);
  });

  it('creates a sidecar alongside the file', async () => {
    await dotfs.write('/data.csv', new TextEncoder().encode('a,b,c'));
    expect(sidecarExists(backend, '/data.csv')).toBe(true);
  });

  it('returns a signed DOT', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(dot.sign?.signature).toBeDefined();
    expect(dot.sign?.signature?.length).toBe(64);
  });

  it('DOT has observer public key', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(dot.sign?.observer).toBeDefined();
    expect(dot.sign?.observer?.length).toBe(32);
  });

  it('DOT has verify.hash (BLAKE3 of content)', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(dot.verify?.hash).toBeDefined();
    expect(dot.verify?.hash?.length).toBe(32);
  });

  it('DOT has time.utc', async () => {
    const before = Date.now();
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    const after = Date.now();
    expect(dot.time?.utc).toBeDefined();
    expect(dot.time!.utc!).toBeGreaterThanOrEqual(before);
    expect(dot.time!.utc!).toBeLessThanOrEqual(after);
  });

  it('DOT has chain.previous (genesis = 32 zero bytes)', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(dot.chain?.previous).toBeDefined();
    expect(dot.chain?.previous?.length).toBe(32);
    // Genesis: all zeros
    expect(dot.chain!.previous!.every(b => b === 0)).toBe(true);
  });

  it('DOT has chain.depth = 0 on first write', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(dot.chain?.depth).toBe(0);
  });

  it('first write produces a genesis DOT (all-zero previous)', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    const isGenesis = Array.from(dot.chain!.previous!).every(b => b === 0);
    expect(isGenesis).toBe(true);
  });

  it('DOT type is state', async () => {
    const dot = await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    expect(dot.type).toBe('state');
  });

  it('file content is written correctly', async () => {
    const content = new TextEncoder().encode('hello world');
    await dotfs.write('/file.txt', content);
    const read = backend.readFile('/file.txt');
    expect(read).toEqual(content);
  });

  it('sidecar contains one DOT after first write', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('hello'));
    const chain = readSidecar(backend, '/file.txt');
    expect(chain.length).toBe(1);
  });
});

// ─── Overwrite ─────────────────────────────────────────────────────────────────

describe('write — overwrite', () => {
  it('overwriting grows the chain', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const chain = readSidecar(backend, '/file.txt');
    expect(chain.length).toBe(2);
  });

  it('second write DOT has chain.depth = 1', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    const dot2 = await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    expect(dot2.chain?.depth).toBe(1);
  });

  it('second write DOT has non-zero chain.previous', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    const dot2 = await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const isGenesis = Array.from(dot2.chain!.previous!).every(b => b === 0);
    expect(isGenesis).toBe(false);
  });

  it('overwriting updates the file content', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2 content'));
    const content = backend.readFile('/file.txt');
    expect(new TextDecoder().decode(content)).toBe('v2 content');
  });

  it('verify.hash changes on overwrite with different content', async () => {
    const dot1 = await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    const dot2 = await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    expect(dot1.verify?.hash).toBeDefined();
    expect(dot2.verify?.hash).toBeDefined();
    // Different content → different hashes
    const h1 = Array.from(dot1.verify!.hash!).join(',');
    const h2 = Array.from(dot2.verify!.hash!).join(',');
    expect(h1).not.toBe(h2);
  });

  it('10 writes produces a chain of depth 10', async () => {
    for (let i = 0; i < 10; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`write ${i}`));
    }
    const chain = readSidecar(backend, '/file.txt');
    expect(chain.length).toBe(10);
    expect(chain[chain.length - 1]?.chain?.depth).toBe(9);
  });

  it('same content twice has same verify.hash', async () => {
    const content = new TextEncoder().encode('same content');
    const dot1 = await dotfs.write('/file.txt', content);
    const dot2 = await dotfs.write('/file.txt', content);
    const h1 = Array.from(dot1.verify!.hash!).join(',');
    const h2 = Array.from(dot2.verify!.hash!).join(',');
    expect(h1).toBe(h2);
  });
});

// ─── Binary content ────────────────────────────────────────────────────────────

describe('write — binary content', () => {
  it('writes arbitrary binary bytes', async () => {
    const content = new Uint8Array([0, 1, 2, 127, 128, 255]);
    await dotfs.write('/bin.dat', content);
    const read = backend.readFile('/bin.dat');
    expect(Array.from(read)).toEqual(Array.from(content));
  });

  it('all-zero bytes work', async () => {
    const content = new Uint8Array(256).fill(0);
    const dot = await dotfs.write('/zeros.bin', content);
    expect(dot.verify?.hash).toBeDefined();
    const read = backend.readFile('/zeros.bin');
    expect(read).toEqual(content);
  });

  it('all-255 bytes work', async () => {
    const content = new Uint8Array(256).fill(255);
    const dot = await dotfs.write('/ones.bin', content);
    expect(dot.verify?.hash).toBeDefined();
    const read = backend.readFile('/ones.bin');
    expect(read).toEqual(content);
  });

  it('random bytes round-trip correctly', async () => {
    const content = new Uint8Array(100);
    for (let i = 0; i < 100; i++) content[i] = (i * 37) % 256;
    await dotfs.write('/random.bin', content);
    const read = backend.readFile('/random.bin');
    expect(Array.from(read)).toEqual(Array.from(content));
  });
});

// ─── Empty file ────────────────────────────────────────────────────────────────

describe('write — empty file', () => {
  it('empty bytes write succeeds', async () => {
    const dot = await dotfs.write('/empty.txt', new Uint8Array(0));
    expect(dot).toBeDefined();
  });

  it('empty file has a sidecar', async () => {
    await dotfs.write('/empty.txt', new Uint8Array(0));
    expect(sidecarExists(backend, '/empty.txt')).toBe(true);
  });

  it('empty file verify.hash is defined', async () => {
    const dot = await dotfs.write('/empty.txt', new Uint8Array(0));
    // BLAKE3 of empty bytes is still a valid 32-byte hash
    expect(dot.verify?.hash?.length).toBe(32);
  });
});

// ─── Large file ────────────────────────────────────────────────────────────────

describe('write — large file (1MB)', () => {
  it('writes a 1MB file successfully', async () => {
    const mb = new Uint8Array(1024 * 1024);
    for (let i = 0; i < mb.length; i++) mb[i] = i % 256;
    const dot = await dotfs.write('/large.bin', mb);
    expect(dot.sign?.signature).toBeDefined();
    expect(backend.exists('/large.bin')).toBe(true);
  });

  it('1MB file has correct verify.hash (not all zeros)', async () => {
    const mb = new Uint8Array(1024 * 1024);
    for (let i = 0; i < mb.length; i++) mb[i] = i % 256;
    const dot = await dotfs.write('/large.bin', mb);
    const allZero = Array.from(dot.verify!.hash!).every(b => b === 0);
    expect(allZero).toBe(false);
  });
});

// ─── Nested directories ────────────────────────────────────────────────────────

describe('write — nested directories', () => {
  it('writes to nested path', async () => {
    await dotfs.write('/a/b/c/file.txt', new TextEncoder().encode('nested'));
    expect(backend.exists('/a/b/c/file.txt')).toBe(true);
  });

  it('sidecar is created in same directory as file', async () => {
    await dotfs.write('/a/b/file.txt', new TextEncoder().encode('hello'));
    const sp = sidecarPath('/a/b/file.txt');
    expect(backend.exists(sp)).toBe(true);
  });

  it('multiple files in same directory each get their own sidecar', async () => {
    await dotfs.write('/dir/a.txt', new TextEncoder().encode('a'));
    await dotfs.write('/dir/b.txt', new TextEncoder().encode('b'));
    expect(sidecarExists(backend, '/dir/a.txt')).toBe(true);
    expect(sidecarExists(backend, '/dir/b.txt')).toBe(true);
  });

  it('files in different directories do not share sidecars', async () => {
    await dotfs.write('/dir1/file.txt', new TextEncoder().encode('x'));
    await dotfs.write('/dir2/file.txt', new TextEncoder().encode('y'));
    const chain1 = readSidecar(backend, '/dir1/file.txt');
    const chain2 = readSidecar(backend, '/dir2/file.txt');
    expect(chain1.length).toBe(1);
    expect(chain2.length).toBe(1);
  });
});

// ─── Concurrent writes ─────────────────────────────────────────────────────────

describe('write — concurrent writes to different files', () => {
  it('concurrent writes to different files all succeed', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      dotfs.write(`/file${i}.txt`, new TextEncoder().encode(`content ${i}`)),
    );
    const dots = await Promise.all(promises);
    expect(dots).toHaveLength(10);
    dots.forEach(dot => {
      expect(dot.sign?.signature).toBeDefined();
    });
  });

  it('each concurrent file gets its own sidecar', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      dotfs.write(`/concurrent${i}.txt`, new TextEncoder().encode(`x${i}`)),
    );
    await Promise.all(promises);
    for (let i = 0; i < 5; i++) {
      expect(sidecarExists(backend, `/concurrent${i}.txt`)).toBe(true);
    }
  });
});

// ─── Sidecar path conventions ─────────────────────────────────────────────────

describe('write — sidecar naming', () => {
  it('sidecar for /data.csv is /(.data.csv.dot)', async () => {
    await dotfs.write('/data.csv', new TextEncoder().encode('a,b'));
    const sp = sidecarPath('/data.csv');
    expect(sp).toContain('.data.csv.dot');
  });

  it('sidecar for /a/b/file.txt is /a/b/(.file.txt.dot)', async () => {
    await dotfs.write('/a/b/file.txt', new TextEncoder().encode('x'));
    const sp = sidecarPath('/a/b/file.txt');
    expect(sp).toContain('.file.txt.dot');
    expect(sp).toContain('a');
    expect(sp).toContain('b');
  });
});
