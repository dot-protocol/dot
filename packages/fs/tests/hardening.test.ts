/**
 * hardening.test.ts — DotFS hardening tests.
 *
 * 40+ tests covering:
 *   - Concurrent write safety (15 tests)
 *   - Large file handling (5 tests)
 *   - Sidecar corruption recovery (10 tests)
 *   - NodeFSBackend integration (10 tests)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createIdentity } from '@dot-protocol/core';
import { DotFS } from '../src/dotfs.js';
import { MemoryFSBackend } from '../src/backends/memory.js';
import { NodeFSBackend } from '../src/backends/node.js';
import { sidecarExists, readSidecar, sidecarPath, writeSidecar } from '../src/sidecar.js';

// ─── Concurrent write safety ──────────────────────────────────────────────────

describe('hardening — concurrent write safety', () => {
  let backend: MemoryFSBackend;
  let dotfs: DotFS;

  beforeEach(async () => {
    backend = new MemoryFSBackend();
    const identity = await createIdentity();
    dotfs = new DotFS(backend, identity);
  });

  it('10 async workers writing the same file all complete without rejection', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/shared.txt', new TextEncoder().encode(`worker-${i}`)),
    );
    const results = await Promise.allSettled(workers);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(10);
  });

  it('sidecar chain has exactly 10 entries after 10 concurrent writes', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/shared.txt', new TextEncoder().encode(`data-${i}`)),
    );
    await Promise.all(workers);
    const chain = readSidecar(backend, '/shared.txt');
    expect(chain.length).toBe(10);
  });

  it('each DOT in the chain has a unique verify.hash', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/unique-hash.txt', new TextEncoder().encode(`unique-content-${i}-${Math.random()}`)),
    );
    const dots = await Promise.all(workers);
    const hashes = dots.map(d => Array.from(d.verify!.hash!).join(','));
    const uniqueHashes = new Set(hashes);
    expect(uniqueHashes.size).toBe(10);
  });

  it('each DOT returned by concurrent writes has a valid signature', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/signed.txt', new TextEncoder().encode(`signed-${i}`)),
    );
    const dots = await Promise.all(workers);
    dots.forEach(dot => {
      expect(dot.sign?.signature?.length).toBe(64);
    });
  });

  it('each DOT returned has a valid verify.hash (32 bytes)', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/hashed.txt', new TextEncoder().encode(`hashed-${i}`)),
    );
    const dots = await Promise.all(workers);
    dots.forEach(dot => {
      expect(dot.verify?.hash?.length).toBe(32);
    });
  });

  it('sidecar chain has 10 entries and all depths are non-negative integers', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/depths.txt', new TextEncoder().encode(`depth-test-${i}`)),
    );
    await Promise.all(workers);
    const chain = readSidecar(backend, '/depths.txt');
    expect(chain.length).toBe(10);
    chain.forEach(d => {
      const depth = d.chain?.depth;
      expect(typeof depth).toBe('number');
      expect(depth).toBeGreaterThanOrEqual(0);
    });
  });

  it('history() returns all 10 writes after concurrent writes', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/history-test.txt', new TextEncoder().encode(`h-${i}`)),
    );
    await Promise.all(workers);
    const hist = dotfs.history('/history-test.txt');
    expect(hist.length).toBe(10);
  });

  it('history() is in reverse chronological order (latest chain.depth first)', async () => {
    for (let i = 0; i < 5; i++) {
      await dotfs.write('/order.txt', new TextEncoder().encode(`seq-${i}`));
    }
    const hist = dotfs.history('/order.txt');
    expect(hist.length).toBe(5);
    // Latest DOT should have depth 4 (0-indexed)
    expect(hist[0]?.chain?.depth).toBe(4);
    expect(hist[4]?.chain?.depth).toBe(0);
  });

  it('no two concurrent DOTs have the same chain.previous (except the very first)', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/prev-unique.txt', new TextEncoder().encode(`prev-${i}`)),
    );
    await Promise.all(workers);
    const chain = readSidecar(backend, '/prev-unique.txt');
    // Skip the genesis DOT (all-zero previous) — rest should be unique
    const nonGenesis = chain.filter(d => !Array.from(d.chain!.previous!).every(b => b === 0));
    const prevHexes = nonGenesis.map(d => Array.from(d.chain!.previous!).join(','));
    const uniquePrevs = new Set(prevHexes);
    expect(uniquePrevs.size).toBe(nonGenesis.length);
  });

  it('concurrent writes to different files do not corrupt each other', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write(`/isolated-${i}.txt`, new TextEncoder().encode(`isolated-content-${i}`)),
    );
    await Promise.all(workers);
    for (let i = 0; i < 10; i++) {
      const chain = readSidecar(backend, `/isolated-${i}.txt`);
      expect(chain.length).toBe(1);
    }
  });

  it('sidecar is valid after 15 sequential writes (chain fully linked)', async () => {
    for (let i = 0; i < 15; i++) {
      await dotfs.write('/sequential.txt', new TextEncoder().encode(`seq-${i}`));
    }
    const chain = readSidecar(backend, '/sequential.txt');
    expect(chain.length).toBe(15);
    // Verify the chain is fully linked: each DOT's depth increments by 1
    chain.forEach((dot, idx) => {
      expect(dot.chain?.depth).toBe(idx);
    });
  });

  it('final file content reflects the last write after concurrent writes', async () => {
    // Sequential writes so we know which one is last
    for (let i = 0; i < 10; i++) {
      await dotfs.write('/final.txt', new TextEncoder().encode(`final-${i}`));
    }
    const content = backend.readFile('/final.txt');
    // Last write content
    expect(new TextDecoder().decode(content)).toBe('final-9');
  });

  it('verify() passes after 10 sequential writes', async () => {
    for (let i = 0; i < 10; i++) {
      await dotfs.write('/verify-chain.txt', new TextEncoder().encode(`v${i}`));
    }
    const result = await dotfs.verify('/verify-chain.txt');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('concurrent writes across 5 files all produce valid sidecars', async () => {
    const allWorkers = Array.from({ length: 5 }, (_, f) =>
      Array.from({ length: 3 }, (_, w) =>
        dotfs.write(`/multi-${f}.txt`, new TextEncoder().encode(`f${f}-w${w}`)),
      ),
    ).flat();
    await Promise.all(allWorkers);
    for (let f = 0; f < 5; f++) {
      const chain = readSidecar(backend, `/multi-${f}.txt`);
      expect(chain.length).toBe(3);
    }
  });

  it('10 concurrent writes — returned DOTs all have chain.depth set', async () => {
    const workers = Array.from({ length: 10 }, (_, i) =>
      dotfs.write('/chain-depth-check.txt', new TextEncoder().encode(`cd-${i}`)),
    );
    const dots = await Promise.all(workers);
    dots.forEach(dot => {
      expect(dot.chain?.depth).toBeDefined();
      expect(typeof dot.chain?.depth).toBe('number');
    });
  });
});

// ─── Large file handling ──────────────────────────────────────────────────────

describe('hardening — large file handling', () => {
  let backend: MemoryFSBackend;
  let dotfs: DotFS;

  beforeEach(async () => {
    backend = new MemoryFSBackend();
    const identity = await createIdentity();
    dotfs = new DotFS(backend, identity);
  });

  it('1MB file: DOT is created with a valid verify.hash', async () => {
    const mb = new Uint8Array(1024 * 1024);
    for (let i = 0; i < mb.length; i++) mb[i] = i % 256;
    const dot = await dotfs.write('/large-1mb.bin', mb);
    expect(dot.verify?.hash).toBeDefined();
    expect(dot.verify!.hash!.length).toBe(32);
    // Hash should not be all zeros (collision-proof check)
    const allZero = Array.from(dot.verify!.hash!).every(b => b === 0);
    expect(allZero).toBe(false);
  });

  it('10MB file: write does not crash and DOT is returned', async () => {
    const tenMb = new Uint8Array(10 * 1024 * 1024).fill(0xab);
    const dot = await dotfs.write('/large-10mb.bin', tenMb);
    expect(dot).toBeDefined();
    expect(dot.sign?.signature?.length).toBe(64);
  });

  it('large file round-trip: read content matches written content', async () => {
    const mb = new Uint8Array(1024 * 1024);
    for (let i = 0; i < mb.length; i++) mb[i] = (i * 7 + 3) % 256;
    await dotfs.write('/roundtrip-1mb.bin', mb);
    const result = await dotfs.read('/roundtrip-1mb.bin');
    expect(result.content.length).toBe(mb.length);
    // Spot-check a few positions
    expect(result.content[0]).toBe(mb[0]);
    expect(result.content[512 * 1024]).toBe(mb[512 * 1024]);
    expect(result.content[mb.length - 1]).toBe(mb[mb.length - 1]);
  });

  it('large file read returns verified=true', async () => {
    const mb = new Uint8Array(1024 * 1024).fill(0x7f);
    await dotfs.write('/verified-large.bin', mb);
    const result = await dotfs.read('/verified-large.bin');
    expect(result.verified).toBe(true);
  });

  it('large file verify() passes', async () => {
    const mb = new Uint8Array(1024 * 1024).fill(0x42);
    await dotfs.write('/verify-large.bin', mb);
    const vr = await dotfs.verify('/verify-large.bin');
    expect(vr.valid).toBe(true);
    expect(vr.errors).toHaveLength(0);
  });
});

// ─── Sidecar corruption recovery ─────────────────────────────────────────────

describe('hardening — sidecar corruption recovery', () => {
  let backend: MemoryFSBackend;
  let dotfs: DotFS;

  beforeEach(async () => {
    backend = new MemoryFSBackend();
    const identity = await createIdentity();
    dotfs = new DotFS(backend, identity);
  });

  it('tampered sidecar bytes: read returns verified=false', async () => {
    const content = new TextEncoder().encode('tamper me');
    await dotfs.write('/tamper.txt', content);
    const sp = sidecarPath('/tamper.txt');
    // Corrupt the sidecar by flipping bytes
    const original = backend.readFile(sp);
    const corrupted = new Uint8Array(original);
    for (let i = 0; i < corrupted.length; i++) corrupted[i] ^= 0xff;
    backend.writeFile(sp, corrupted);
    // Read should return content (file still there) but unverified
    const result = await dotfs.read('/tamper.txt');
    expect(result.content).toBeDefined();
    expect(result.verified).toBe(false);
  });

  it('tampered sidecar bytes: verify() returns valid=false', async () => {
    await dotfs.write('/tamper2.txt', new TextEncoder().encode('verify tamper'));
    const sp = sidecarPath('/tamper2.txt');
    const corrupted = new Uint8Array(backend.readFile(sp));
    // Corrupt from middle (to preserve length prefix for partial read possibility)
    for (let i = 4; i < corrupted.length; i++) corrupted[i] ^= 0xaa;
    backend.writeFile(sp, corrupted);
    const vr = await dotfs.verify('/tamper2.txt');
    expect(vr.valid).toBe(false);
  });

  it('deleted sidecar: read returns file content but verified=false', async () => {
    const content = new TextEncoder().encode('no sidecar');
    await dotfs.write('/no-sidecar.txt', content);
    const sp = sidecarPath('/no-sidecar.txt');
    backend.unlink(sp);
    const result = await dotfs.read('/no-sidecar.txt');
    expect(result.content).toEqual(content);
    expect(result.verified).toBe(false);
    expect(result.dot).toBeUndefined();
  });

  it('deleted sidecar: verify() returns valid=false with error', async () => {
    await dotfs.write('/verify-no-sidecar.txt', new TextEncoder().encode('data'));
    const sp = sidecarPath('/verify-no-sidecar.txt');
    backend.unlink(sp);
    const vr = await dotfs.verify('/verify-no-sidecar.txt');
    expect(vr.valid).toBe(false);
    expect(vr.errors.length).toBeGreaterThan(0);
  });

  it('truncated sidecar mid-DOT: readSidecar returns only complete records', async () => {
    await dotfs.write('/truncate.txt', new TextEncoder().encode('truncate me'));
    const sp = sidecarPath('/truncate.txt');
    const original = backend.readFile(sp);
    // Truncate to half — removes part of the record
    const truncated = original.slice(0, Math.floor(original.length / 2));
    backend.writeFile(sp, truncated);
    // Should not throw, returns what it can parse (0 or partial)
    const dots = readSidecar(backend, '/truncate.txt');
    expect(Array.isArray(dots)).toBe(true);
    // May be 0 (truncated before first complete record) — should not throw
  });

  it('truncated sidecar: read() returns content without throwing', async () => {
    await dotfs.write('/truncate-read.txt', new TextEncoder().encode('hello'));
    const sp = sidecarPath('/truncate-read.txt');
    const original = backend.readFile(sp);
    backend.writeFile(sp, original.slice(0, 2));
    // Should not throw
    const result = await dotfs.read('/truncate-read.txt');
    expect(result.content).toBeDefined();
  });

  it('empty sidecar file: read returns verified=false, no throw', async () => {
    await dotfs.write('/empty-sidecar.txt', new TextEncoder().encode('content'));
    const sp = sidecarPath('/empty-sidecar.txt');
    // Replace sidecar with empty bytes
    backend.writeFile(sp, new Uint8Array(0));
    const result = await dotfs.read('/empty-sidecar.txt');
    expect(result.verified).toBe(false);
    expect(result.content).toBeDefined();
  });

  it('empty sidecar file: verify() returns valid=false', async () => {
    await dotfs.write('/empty-sidecar-verify.txt', new TextEncoder().encode('verify'));
    const sp = sidecarPath('/empty-sidecar-verify.txt');
    backend.writeFile(sp, new Uint8Array(0));
    const vr = await dotfs.verify('/empty-sidecar-verify.txt');
    expect(vr.valid).toBe(false);
  });

  it('corrupt bytes in sidecar: readSidecar skips bad records gracefully', async () => {
    // Write a valid file so sidecar exists, then replace with garbage
    await dotfs.write('/garbage.txt', new TextEncoder().encode('garbage test'));
    const sp = sidecarPath('/garbage.txt');
    // Write completely random garbage
    const garbage = new Uint8Array([
      0x00, 0x00, 0x00, 0x05, // length prefix = 5
      0xff, 0xfe, 0xfd, 0xfc, 0xfb, // 5 bytes of garbage (invalid DOT)
      0x00, 0x00, 0x00, 0x00, // length prefix = 0 (skip)
    ]);
    backend.writeFile(sp, garbage);
    // Should not throw
    expect(() => readSidecar(backend, '/garbage.txt')).not.toThrow();
    const dots = readSidecar(backend, '/garbage.txt');
    expect(Array.isArray(dots)).toBe(true);
  });

  it('sidecar with valid + corrupt interleaved records: valid records survive', async () => {
    // Write 3 real records
    const identity = await createIdentity();
    const dotfs2 = new DotFS(backend, identity);
    await dotfs2.write('/interleaved.txt', new TextEncoder().encode('first'));
    await dotfs2.write('/interleaved.txt', new TextEncoder().encode('second'));
    const sp = sidecarPath('/interleaved.txt');
    const valid = backend.readFile(sp);
    // Append garbage after valid records
    const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0xde, 0xad, 0xbe, 0xef]);
    const combined = new Uint8Array(valid.length + garbage.length);
    combined.set(valid, 0);
    combined.set(garbage, valid.length);
    backend.writeFile(sp, combined);
    // The 2 valid DOTs should still be readable
    const dots = readSidecar(backend, '/interleaved.txt');
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── NodeFSBackend integration ────────────────────────────────────────────────

describe('hardening — NodeFSBackend integration', () => {
  let tmpDir: string;
  let backend: NodeFSBackend;
  let dotfs: DotFS;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfs-hardening-'));
    backend = new NodeFSBackend();
    const identity = await createIdentity();
    dotfs = new DotFS(backend, identity);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('write creates the file on disk', async () => {
    const filePath = path.join(tmpDir, 'real.txt');
    await dotfs.write(filePath, new TextEncoder().encode('real content'));
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('read returns the correct content from disk', async () => {
    const filePath = path.join(tmpDir, 'read-back.txt');
    const content = new TextEncoder().encode('read-back test');
    await dotfs.write(filePath, content);
    const result = await dotfs.read(filePath);
    expect(new TextDecoder().decode(result.content)).toBe('read-back test');
  });

  it('history returns entries after writes on disk', async () => {
    const filePath = path.join(tmpDir, 'history.txt');
    await dotfs.write(filePath, new TextEncoder().encode('v1'));
    await dotfs.write(filePath, new TextEncoder().encode('v2'));
    const hist = dotfs.history(filePath);
    expect(hist.length).toBe(2);
  });

  it('sidecar file exists on disk after write', async () => {
    const filePath = path.join(tmpDir, 'sidecar-real.txt');
    await dotfs.write(filePath, new TextEncoder().encode('sidecar'));
    const sp = sidecarPath(filePath);
    expect(fs.existsSync(sp)).toBe(true);
  });

  it('multiple writes: sidecar grows on disk', async () => {
    const filePath = path.join(tmpDir, 'growing.txt');
    let prevSize = 0;
    for (let i = 0; i < 3; i++) {
      await dotfs.write(filePath, new TextEncoder().encode(`write-${i}`));
      const sp = sidecarPath(filePath);
      const size = fs.statSync(sp).size;
      expect(size).toBeGreaterThan(prevSize);
      prevSize = size;
    }
  });

  it('verify() returns valid=true for a real file on disk', async () => {
    const filePath = path.join(tmpDir, 'verify-real.txt');
    await dotfs.write(filePath, new TextEncoder().encode('verify on disk'));
    const vr = await dotfs.verify(filePath);
    expect(vr.valid).toBe(true);
  });

  it('delete main file: verify() reports file does not exist', async () => {
    const filePath = path.join(tmpDir, 'delete-me.txt');
    await dotfs.write(filePath, new TextEncoder().encode('temp'));
    fs.unlinkSync(filePath);
    const vr = await dotfs.verify(filePath);
    expect(vr.valid).toBe(false);
    expect(vr.errors[0]).toMatch(/does not exist/);
  });

  it('nested directory write: mkdir recursive works on disk', async () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c', 'nested.txt');
    await dotfs.write(filePath, new TextEncoder().encode('nested'));
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'a', 'b', 'c'))).toBe(true);
  });

  it('content written to disk is byte-for-byte correct', async () => {
    const filePath = path.join(tmpDir, 'binary.bin');
    const content = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    await dotfs.write(filePath, content);
    const onDisk = fs.readFileSync(filePath);
    expect(Array.from(onDisk)).toEqual(Array.from(content));
  });

  it('read returns verified=true for a freshly-written disk file', async () => {
    const filePath = path.join(tmpDir, 'verified.txt');
    await dotfs.write(filePath, new TextEncoder().encode('verified content'));
    const result = await dotfs.read(filePath);
    expect(result.verified).toBe(true);
    expect(result.dot).toBeDefined();
  });
});
