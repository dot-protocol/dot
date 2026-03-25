/**
 * storage.test.ts — Tests for MemoryStorage and IndexedDBStorage (in-memory mode).
 *
 * In Node.js/Vitest, IndexedDBStorage automatically falls back to MemoryStorage
 * since `indexedDB` is not available. Both share the same async interface.
 *
 * Tests marked .browser.test.ts would cover real IndexedDB behavior via Playwright.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage, IndexedDBStorage } from '../src/storage/indexeddb.js';
import type { DOT } from '@dot-protocol/core';

// ── Fixtures ──────────────────────────────────────────────────────────────

function makeDot(content: string): DOT {
  return {
    payload: new TextEncoder().encode(content),
    payload_mode: 'plain',
    type: 'claim',
    time: { utc: Date.now() },
  };
}

// ── MemoryStorage tests ───────────────────────────────────────────────────

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.open();
  });

  it('starts empty', async () => {
    expect(await storage.count()).toBe(0);
    expect(await storage.list()).toEqual([]);
  });

  it('put + get roundtrip', async () => {
    const dot = makeDot('hello world');
    await storage.put('abc123', dot);
    const retrieved = await storage.get('abc123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.payload).toEqual(dot.payload);
    expect(retrieved?.type).toBe('claim');
  });

  it('get returns null for missing key', async () => {
    const result = await storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('has returns true for existing key', async () => {
    await storage.put('key1', makeDot('test'));
    expect(await storage.has('key1')).toBe(true);
  });

  it('has returns false for missing key', async () => {
    expect(await storage.has('missing-key')).toBe(false);
  });

  it('list returns all stored dots', async () => {
    await storage.put('a', makeDot('alpha'));
    await storage.put('b', makeDot('beta'));
    await storage.put('c', makeDot('gamma'));
    const all = await storage.list();
    expect(all).toHaveLength(3);
  });

  it('count returns correct number after puts', async () => {
    expect(await storage.count()).toBe(0);
    await storage.put('x1', makeDot('one'));
    expect(await storage.count()).toBe(1);
    await storage.put('x2', makeDot('two'));
    expect(await storage.count()).toBe(2);
  });

  it('clear empties the store', async () => {
    await storage.put('d1', makeDot('to delete'));
    await storage.put('d2', makeDot('also delete'));
    expect(await storage.count()).toBe(2);
    await storage.clear();
    expect(await storage.count()).toBe(0);
    expect(await storage.list()).toEqual([]);
  });

  it('overwriting a key replaces the dot', async () => {
    const original = makeDot('original');
    const updated = makeDot('updated');
    await storage.put('same-key', original);
    await storage.put('same-key', updated);
    const result = await storage.get('same-key');
    expect(new TextDecoder().decode(result?.payload)).toBe('updated');
    expect(await storage.count()).toBe(1);
  });

  it('throws if used before open()', async () => {
    const fresh = new MemoryStorage();
    await expect(fresh.get('k')).rejects.toThrow('open()');
  });

  it('stores DOT with all STCV bases', async () => {
    const fullDot: DOT = {
      payload: new TextEncoder().encode('full dot'),
      payload_mode: 'plain',
      type: 'measure',
      sign: {
        observer: new Uint8Array(32).fill(0xab),
        signature: new Uint8Array(64).fill(0xcd),
      },
      time: { utc: 1700000000000, monotonic: 42 },
      chain: { previous: new Uint8Array(32), depth: 7 },
      verify: { hash: new Uint8Array(32).fill(0xef) },
    };
    await storage.put('full', fullDot);
    const retrieved = await storage.get('full');
    expect(retrieved?.chain?.depth).toBe(7);
    expect(retrieved?.sign?.observer).toEqual(fullDot.sign?.observer);
    expect(retrieved?.time?.monotonic).toBe(42);
  });
});

// ── IndexedDBStorage (falls back to MemoryStorage in Node.js) ────────────

describe('IndexedDBStorage (Node fallback = MemoryStorage)', () => {
  let storage: IndexedDBStorage;

  beforeEach(async () => {
    storage = new IndexedDBStorage('test-db-' + Math.random().toString(36).slice(2));
    await storage.open();
  });

  it('opens without error in Node.js (falls back to memory)', async () => {
    // No error thrown — fallback activated
    expect(await storage.count()).toBe(0);
  });

  it('put + get roundtrip via fallback', async () => {
    const dot = makeDot('indexeddb fallback test');
    await storage.put('hash-001', dot);
    const result = await storage.get('hash-001');
    expect(result).not.toBeNull();
    expect(new TextDecoder().decode(result?.payload)).toBe('indexeddb fallback test');
  });

  it('has returns correct boolean', async () => {
    await storage.put('exists', makeDot('yes'));
    expect(await storage.has('exists')).toBe(true);
    expect(await storage.has('nope')).toBe(false);
  });

  it('list returns all items', async () => {
    await storage.put('i1', makeDot('item1'));
    await storage.put('i2', makeDot('item2'));
    const items = await storage.list();
    expect(items.length).toBe(2);
  });

  it('count returns correct number', async () => {
    await storage.put('c1', makeDot('one'));
    await storage.put('c2', makeDot('two'));
    await storage.put('c3', makeDot('three'));
    expect(await storage.count()).toBe(3);
  });

  it('clear empties the store', async () => {
    await storage.put('r1', makeDot('remove me'));
    await storage.clear();
    expect(await storage.count()).toBe(0);
  });

  it('supports multiple independent instances', async () => {
    const storage2 = new IndexedDBStorage('test-db-separate');
    await storage2.open();
    await storage.put('key', makeDot('in storage1'));
    // storage2 is separate — should be empty
    expect(await storage2.count()).toBe(0);
  });
});
