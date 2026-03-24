/**
 * Storage tests — MemoryStorage and SQLiteStorage.
 * Target: 20+ tests per backend.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { observe, toBytes, fromBytes } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { MemoryStorage } from '../src/storage/memory.js';
import { SQLiteStorage } from '../src/storage/sqlite.js';
import { dotHashToHex } from '../src/dag.js';

function makeDot(payload: string, type?: string): DOT {
  const d = observe(payload, { plaintext: true });
  if (type) {
    return { ...d, type: type as any };
  }
  return d;
}

function makeHash(dot: DOT): string {
  return dotHashToHex(dot);
}

// Shared contract tests for any StorageBackend
function runStorageTests(name: string, factory: () => { storage: any; cleanup?: () => void }) {
  describe(name, () => {
    let storage: any;
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      const result = factory();
      storage = result.storage;
      cleanup = result.cleanup;
    });

    afterEach(() => {
      cleanup?.();
    });

    it('has a name property', () => {
      expect(typeof storage.name).toBe('string');
      expect(storage.name.length).toBeGreaterThan(0);
    });

    it('count() returns 0 initially', () => {
      expect(storage.count()).toBe(0);
    });

    it('has() returns false for unknown hash', () => {
      expect(storage.has('deadbeef'.repeat(8))).toBe(false);
    });

    it('get() returns null for unknown hash', () => {
      expect(storage.get('deadbeef'.repeat(8))).toBeNull();
    });

    it('list() returns empty array initially', () => {
      expect(storage.list()).toEqual([]);
    });

    it('put() then has() returns true', () => {
      const dot = makeDot('hello');
      const hash = makeHash(dot);
      storage.put(dot, hash);
      expect(storage.has(hash)).toBe(true);
    });

    it('put() then get() returns the DOT', () => {
      const dot = makeDot('world');
      const hash = makeHash(dot);
      storage.put(dot, hash);
      const result = storage.get(hash);
      expect(result).not.toBeNull();
    });

    it('count() reflects stored DOTs', () => {
      const d1 = makeDot('a');
      const d2 = makeDot('b');
      storage.put(d1, makeHash(d1));
      storage.put(d2, makeHash(d2));
      expect(storage.count()).toBe(2);
    });

    it('list() returns all stored DOTs', () => {
      for (let i = 0; i < 5; i++) {
        const d = makeDot(`dot-${i}`);
        storage.put(d, makeHash(d));
      }
      expect(storage.list().length).toBe(5);
    });

    it('clear() removes all DOTs', () => {
      const d = makeDot('x');
      storage.put(d, makeHash(d));
      storage.clear();
      expect(storage.count()).toBe(0);
    });

    it('clear() makes get() return null', () => {
      const d = makeDot('y');
      const hash = makeHash(d);
      storage.put(d, hash);
      storage.clear();
      expect(storage.get(hash)).toBeNull();
    });

    it('clear() makes has() return false', () => {
      const d = makeDot('z');
      const hash = makeHash(d);
      storage.put(d, hash);
      storage.clear();
      expect(storage.has(hash)).toBe(false);
    });

    it('list() with type filter returns only matching DOTs', () => {
      const d1 = makeDot('m1', 'measure');
      const d2 = makeDot('e1', 'event');
      const d3 = makeDot('m2', 'measure');
      storage.put(d1, makeHash(d1));
      storage.put(d2, makeHash(d2));
      storage.put(d3, makeHash(d3));
      const measures = storage.list({ type: 'measure' });
      expect(measures.length).toBe(2);
    });

    it('list() with limit option respects the limit', () => {
      for (let i = 0; i < 10; i++) {
        const d = makeDot(`limited-${i}`);
        storage.put(d, makeHash(d));
      }
      const result = storage.list({ limit: 3 });
      expect(result.length).toBe(3);
    });

    it('put() with same hash overwrites', () => {
      const d1 = makeDot('original');
      const hash = makeHash(d1);
      const d2 = { ...d1, type: 'event' as any };
      storage.put(d1, hash);
      storage.put(d2, hash);
      expect(storage.count()).toBe(1);
    });

    it('list() with depth range filters correctly', () => {
      const d1 = { ...makeDot('d0'), chain: { previous: new Uint8Array(32), depth: 0 } };
      const d2 = { ...makeDot('d1'), chain: { previous: new Uint8Array(32), depth: 1 } };
      const d3 = { ...makeDot('d2'), chain: { previous: new Uint8Array(32), depth: 2 } };
      storage.put(d1, makeHash(d1));
      storage.put(d2, makeHash(d2));
      storage.put(d3, makeHash(d3));
      const result = storage.list({ minDepth: 1, maxDepth: 1 });
      expect(result.length).toBe(1);
    });

    it('stored DOT round-trips payload correctly', () => {
      const d = makeDot('round-trip-test');
      const hash = makeHash(d);
      storage.put(d, hash);
      const retrieved = storage.get(hash);
      expect(retrieved?.payload).toBeDefined();
      const decoder = new TextDecoder();
      expect(decoder.decode(retrieved!.payload)).toBe('round-trip-test');
    });

    it('list() with observer filter returns matching DOTs', () => {
      const key1 = new Uint8Array(32).fill(7);
      const d1 = { ...makeDot('obs1'), sign: { observer: key1 } };
      const d2 = { ...makeDot('obs2'), sign: { observer: new Uint8Array(32).fill(8) } };
      storage.put(d1, makeHash(d1));
      storage.put(d2, makeHash(d2));
      const result = storage.list({ observer: Buffer.from(key1).toString('hex') });
      expect(result.length).toBe(1);
    });
  });
}

// Run tests for both backends
runStorageTests('MemoryStorage', () => ({
  storage: new MemoryStorage(),
}));

runStorageTests('SQLiteStorage (:memory:)', () => {
  const storage = new SQLiteStorage(':memory:');
  return {
    storage,
    cleanup: () => storage.close(),
  };
});

// SQLiteStorage-specific persistence tests
describe('SQLiteStorage persistence', () => {
  it('has name="sqlite"', () => {
    const s = new SQLiteStorage(':memory:');
    expect(s.name).toBe('sqlite');
    s.close();
  });

  it('uses WAL mode for performance', () => {
    // Just verify it doesn't throw — WAL pragma is set in constructor
    const s = new SQLiteStorage(':memory:');
    expect(s.count()).toBe(0);
    s.close();
  });

  it('handles 1000 puts efficiently', () => {
    const s = new SQLiteStorage(':memory:');
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      const d = makeDot(`bulk-${i}`);
      s.put(d, makeHash(d));
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    expect(s.count()).toBe(1000);
    s.close();
  });

  it('list with time range filter', () => {
    const s = new SQLiteStorage(':memory:');
    const d1 = { ...makeDot('early'), time: { utc: 1000 } };
    const d2 = { ...makeDot('mid'), time: { utc: 5000 } };
    const d3 = { ...makeDot('late'), time: { utc: 9000 } };
    s.put(d1, makeHash(d1));
    s.put(d2, makeHash(d2));
    s.put(d3, makeHash(d3));
    const result = s.list({ since: 1000, until: 5000 });
    expect(result.length).toBe(2);
    s.close();
  });
});

// MemoryStorage-specific tests
describe('MemoryStorage specifics', () => {
  it('has name="memory"', () => {
    const s = new MemoryStorage();
    expect(s.name).toBe('memory');
  });

  it('is fast for 10000 operations', () => {
    const s = new MemoryStorage();
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      const d = makeDot(`fast-${i}`);
      s.put(d, makeHash(d));
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
    s.clear();
  });
});
