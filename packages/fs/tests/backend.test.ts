/**
 * backend.test.ts — FSBackend implementation tests.
 *
 * 20+ tests per backend: memory + node.js, all operations, edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MemoryFSBackend } from '../src/backends/memory.js';
import { NodeFSBackend } from '../src/backends/node.js';
import type { FSBackend } from '../src/backends/interface.js';

// ─── Shared backend contract tests ────────────────────────────────────────────

function runBackendTests(name: string, getBackend: () => { backend: FSBackend; root: string; cleanup: () => void }) {
  describe(`${name} — contract`, () => {
    let backend: FSBackend;
    let root: string;
    let cleanup: () => void;

    beforeEach(() => {
      const ctx = getBackend();
      backend = ctx.backend;
      root = ctx.root;
      cleanup = ctx.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    function p(rel: string) {
      return path.join(root, rel);
    }

    // writeFile + readFile

    it('writeFile + readFile round-trip', () => {
      const content = new TextEncoder().encode('hello');
      backend.writeFile(p('file.txt'), content);
      const read = backend.readFile(p('file.txt'));
      expect(new TextDecoder().decode(read)).toBe('hello');
    });

    it('writeFile creates parent dirs', () => {
      const content = new TextEncoder().encode('nested');
      backend.writeFile(p('a/b/c/deep.txt'), content);
      expect(backend.exists(p('a/b/c/deep.txt'))).toBe(true);
    });

    it('readFile returns Uint8Array', () => {
      backend.writeFile(p('file.txt'), new TextEncoder().encode('test'));
      const result = backend.readFile(p('file.txt'));
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('readFile throws for nonexistent file', () => {
      expect(() => backend.readFile(p('does-not-exist.txt'))).toThrow();
    });

    it('writeFile overwrites existing content', () => {
      backend.writeFile(p('file.txt'), new TextEncoder().encode('v1'));
      backend.writeFile(p('file.txt'), new TextEncoder().encode('v2'));
      const read = backend.readFile(p('file.txt'));
      expect(new TextDecoder().decode(read)).toBe('v2');
    });

    it('writeFile handles binary content', () => {
      const binary = new Uint8Array([0, 1, 2, 127, 128, 255]);
      backend.writeFile(p('bin.dat'), binary);
      const read = backend.readFile(p('bin.dat'));
      expect(Array.from(read)).toEqual(Array.from(binary));
    });

    it('writeFile handles empty content', () => {
      backend.writeFile(p('empty.txt'), new Uint8Array(0));
      const read = backend.readFile(p('empty.txt'));
      expect(read.length).toBe(0);
    });

    // exists

    it('exists returns true for existing file', () => {
      backend.writeFile(p('file.txt'), new TextEncoder().encode('x'));
      expect(backend.exists(p('file.txt'))).toBe(true);
    });

    it('exists returns false for nonexistent path', () => {
      expect(backend.exists(p('nope.txt'))).toBe(false);
    });

    // unlink

    it('unlink removes a file', () => {
      backend.writeFile(p('file.txt'), new TextEncoder().encode('x'));
      backend.unlink(p('file.txt'));
      expect(backend.exists(p('file.txt'))).toBe(false);
    });

    it('unlink throws for nonexistent file', () => {
      expect(() => backend.unlink(p('ghost.txt'))).toThrow();
    });

    // list

    it('list returns files in directory', () => {
      backend.writeFile(p('dir/a.txt'), new TextEncoder().encode('a'));
      backend.writeFile(p('dir/b.txt'), new TextEncoder().encode('b'));
      const entries = backend.list(p('dir'));
      expect(entries).toContain('a.txt');
      expect(entries).toContain('b.txt');
    });

    it('list returns empty array for empty directory', () => {
      backend.mkdir(p('empty-dir'));
      const entries = backend.list(p('empty-dir'));
      expect(entries).toHaveLength(0);
    });

    it('list does not recurse into subdirectories', () => {
      backend.writeFile(p('dir/sub/file.txt'), new TextEncoder().encode('x'));
      backend.writeFile(p('dir/top.txt'), new TextEncoder().encode('y'));
      const entries = backend.list(p('dir'));
      // Should contain 'top.txt' and 'sub', but NOT 'sub/file.txt'
      expect(entries).toContain('top.txt');
      expect(entries).not.toContain('sub/file.txt');
    });

    // mkdir

    it('mkdir creates directory', () => {
      backend.mkdir(p('newdir'));
      expect(backend.exists(p('newdir'))).toBe(true);
    });

    it('mkdir creates nested directories', () => {
      backend.mkdir(p('a/b/c'));
      expect(backend.exists(p('a/b/c'))).toBe(true);
    });

    it('mkdir is idempotent (no error on existing dir)', () => {
      backend.mkdir(p('dir'));
      expect(() => backend.mkdir(p('dir'))).not.toThrow();
    });

    // stat

    it('stat returns size', () => {
      backend.writeFile(p('file.txt'), new TextEncoder().encode('hello'));
      const s = backend.stat(p('file.txt'));
      expect(s.size).toBe(5);
    });

    it('stat returns mtime as number', () => {
      backend.writeFile(p('file.txt'), new TextEncoder().encode('x'));
      const s = backend.stat(p('file.txt'));
      expect(typeof s.mtime).toBe('number');
      expect(s.mtime).toBeGreaterThan(0);
    });

    it('stat throws for nonexistent file', () => {
      expect(() => backend.stat(p('ghost.txt'))).toThrow();
    });

    it('stat size = 0 for empty file', () => {
      backend.writeFile(p('empty.txt'), new Uint8Array(0));
      const s = backend.stat(p('empty.txt'));
      expect(s.size).toBe(0);
    });
  });
}

// ─── MemoryFSBackend ──────────────────────────────────────────────────────────

runBackendTests('MemoryFSBackend', () => {
  const backend = new MemoryFSBackend();
  return {
    backend,
    root: '',
    cleanup: () => backend.clear(),
  };
});

// ─── NodeFSBackend ────────────────────────────────────────────────────────────

runBackendTests('NodeFSBackend', () => {
  const backend = new NodeFSBackend();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfs-test-'));
  return {
    backend,
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
});

// ─── MemoryFSBackend-specific tests ───────────────────────────────────────────

describe('MemoryFSBackend — specific', () => {
  it('allFiles() lists all written paths', () => {
    const backend = new MemoryFSBackend();
    backend.writeFile('/a.txt', new TextEncoder().encode('a'));
    backend.writeFile('/b.txt', new TextEncoder().encode('b'));
    expect(backend.allFiles()).toContain('/a.txt');
    expect(backend.allFiles()).toContain('/b.txt');
  });

  it('clear() resets all state', () => {
    const backend = new MemoryFSBackend();
    backend.writeFile('/file.txt', new TextEncoder().encode('x'));
    backend.clear();
    expect(backend.exists('/file.txt')).toBe(false);
    expect(backend.allFiles()).toHaveLength(0);
  });

  it('allDirs() contains root', () => {
    const backend = new MemoryFSBackend();
    expect(backend.allDirs()).toContain('/');
  });

  it('separate instances are isolated', () => {
    const b1 = new MemoryFSBackend();
    const b2 = new MemoryFSBackend();
    b1.writeFile('/file.txt', new TextEncoder().encode('in b1'));
    expect(b2.exists('/file.txt')).toBe(false);
  });
});

// ─── NodeFSBackend-specific tests ─────────────────────────────────────────────

describe('NodeFSBackend — specific', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotfs-node-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('hidden files (starting with .) work correctly', () => {
    const backend = new NodeFSBackend();
    const hiddenPath = path.join(tmpDir, '.hidden.dat');
    backend.writeFile(hiddenPath, new TextEncoder().encode('hidden'));
    expect(backend.exists(hiddenPath)).toBe(true);
    const read = backend.readFile(hiddenPath);
    expect(new TextDecoder().decode(read)).toBe('hidden');
  });

  it('files with .dot extension work correctly', () => {
    const backend = new NodeFSBackend();
    const dotPath = path.join(tmpDir, '.data.csv.dot');
    backend.writeFile(dotPath, new TextEncoder().encode('sidecar'));
    expect(backend.exists(dotPath)).toBe(true);
  });

  it('list includes hidden files', () => {
    const backend = new NodeFSBackend();
    backend.writeFile(path.join(tmpDir, '.hidden'), new TextEncoder().encode('h'));
    backend.writeFile(path.join(tmpDir, 'visible.txt'), new TextEncoder().encode('v'));
    const entries = backend.list(tmpDir);
    expect(entries).toContain('.hidden');
    expect(entries).toContain('visible.txt');
  });
});
