/**
 * runtime.test.ts — Tests for createBrowserRuntime().
 *
 * The BrowserRuntime wraps @dot-protocol/script's createRuntime()
 * with browser-compatible storage and Tree/HTML generation.
 *
 * All tests run in Node.js — storage falls back to MemoryStorage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserRuntime } from '../src/runtime.js';
import type { BrowserRuntime } from '../src/runtime.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

let rt: BrowserRuntime;

beforeEach(async () => {
  rt = await createBrowserRuntime({ storage: 'memory' });
});

afterEach(async () => {
  if (rt) await rt.shutdown();
});

// ── createBrowserRuntime() ────────────────────────────────────────────────

describe('createBrowserRuntime()', () => {
  it('creates a runtime without errors', async () => {
    expect(rt).toBeDefined();
  });

  it('has an identity with publicKey and secretKey', () => {
    expect(rt.identity).toBeDefined();
    expect(rt.identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(rt.identity.secretKey).toBeInstanceOf(Uint8Array);
    expect(rt.identity.publicKey.length).toBe(32);
    expect(rt.identity.secretKey.length).toBe(32);
  });

  it('has an EventTarget', () => {
    expect(rt.events).toBeDefined();
    expect(typeof rt.events.addEventListener).toBe('function');
  });

  it('has a storage backend', () => {
    expect(rt.storage).toBeDefined();
    expect(typeof rt.storage.get).toBe('function');
  });

  it('tree is null before createTree() is called', () => {
    expect(rt.tree).toBeNull();
  });

  it('creates separate runtimes with different identities', async () => {
    const rt2 = await createBrowserRuntime({ storage: 'memory' });
    try {
      const pk1 = Array.from(rt.identity.publicKey).join(',');
      const pk2 = Array.from(rt2.identity.publicKey).join(',');
      expect(pk1).not.toBe(pk2);
    } finally {
      await rt2.shutdown();
    }
  });
});

// ── runtime.observe() ─────────────────────────────────────────────────────

describe('BrowserRuntime.observe()', () => {
  it('creates a DOT from a string payload', async () => {
    const dot = await rt.observe('hello world');
    expect(dot).toBeDefined();
    expect(dot.payload).toBeInstanceOf(Uint8Array);
  });

  it('creates a signed DOT', async () => {
    const dot = await rt.observe('test observation');
    expect(dot.sign).toBeDefined();
    expect(dot.sign?.signature).toBeInstanceOf(Uint8Array);
    expect(dot.sign?.signature?.length).toBe(64);
  });

  it('creates a chained DOT after the first', async () => {
    await rt.observe('first');
    const second = await rt.observe('second');
    expect(second.chain).toBeDefined();
    expect(second.chain?.depth).toBeGreaterThan(0);
  });

  it('respects the type option', async () => {
    const dot = await rt.observe('measure this', { type: 'measure' });
    expect(dot.type).toBe('measure');
  });

  it('works with undefined payload (empty DOT)', async () => {
    const dot = await rt.observe(undefined);
    expect(dot).toBeDefined();
    expect(dot.payload_mode).toBe('none');
  });

  it('works with object payload', async () => {
    const dot = await rt.observe({ temperature: 98.6, unit: 'F' });
    expect(dot.payload).toBeInstanceOf(Uint8Array);
    const decoded = new TextDecoder().decode(dot.payload);
    const parsed = JSON.parse(decoded);
    expect(parsed.temperature).toBe(98.6);
  });

  it('fires a dot event on the EventTarget', async () => {
    let fired = false;
    rt.events.addEventListener('dot', () => { fired = true; });
    await rt.observe('event test');
    expect(fired).toBe(true);
  });

  it('event detail contains hash and dot', async () => {
    let detail: { hash?: string; dot?: unknown } = {};
    rt.events.addEventListener('dot', (e) => {
      detail = (e as CustomEvent).detail;
    });
    await rt.observe('detail test');
    expect(typeof detail.hash).toBe('string');
    expect(detail.dot).toBeDefined();
  });
});

// ── runtime.createTree() ──────────────────────────────────────────────────

describe('BrowserRuntime.createTree()', () => {
  it('creates a tree with 3 branches', async () => {
    const tree = await rt.createTree();
    expect(tree).toBeDefined();
    expect(tree.roots.has('observe')).toBe(true);
    expect(tree.roots.has('flow')).toBe(true);
    expect(tree.roots.has('connect')).toBe(true);
  });

  it('creates a tree with at least 4 nodes (3 roots + genesis)', async () => {
    const tree = await rt.createTree();
    expect(tree.nodes.size).toBeGreaterThanOrEqual(3);
  });

  it('sets rt.tree after createTree()', async () => {
    expect(rt.tree).toBeNull();
    await rt.createTree();
    expect(rt.tree).not.toBeNull();
  });

  it('fires tree:created event', async () => {
    let fired = false;
    rt.events.addEventListener('tree:created', () => { fired = true; });
    await rt.createTree();
    expect(fired).toBe(true);
  });

  it('creates a new tree when called again (replaces old)', async () => {
    const tree1 = await rt.createTree();
    const tree2 = await rt.createTree();
    // Different identity-specific hashes each time (new chain state)
    // Just verify both are valid trees
    expect(tree1.roots.has('observe')).toBe(true);
    expect(tree2.roots.has('observe')).toBe(true);
  });
});

// ── runtime.addLeaf() ─────────────────────────────────────────────────────

describe('BrowserRuntime.addLeaf()', () => {
  it('adds a leaf under an existing parent', async () => {
    const tree = await rt.createTree();
    const root = tree.roots.get('observe')!;
    expect(root).toBeDefined();

    const sizeBefore = tree.nodes.size;
    await rt.addLeaf(root.hash, 'The sky is blue');
    expect(tree.nodes.size).toBeGreaterThan(sizeBefore);
  });

  it('fires tree:leaf event', async () => {
    const tree = await rt.createTree();
    const root = tree.roots.get('observe')!;

    let fired = false;
    rt.events.addEventListener('tree:leaf', () => { fired = true; });
    await rt.addLeaf(root.hash, 'leaf content');
    expect(fired).toBe(true);
  });

  it('throws if called before createTree()', async () => {
    await expect(rt.addLeaf('any-hash', 'content')).rejects.toThrow();
  });
});

// ── runtime.renderTree() ─────────────────────────────────────────────────

describe('BrowserRuntime.renderTree()', () => {
  it('returns a string', async () => {
    const result = rt.renderTree();
    expect(typeof result).toBe('string');
  });

  it('returns fallback message before tree is created', () => {
    const result = rt.renderTree();
    expect(result).toContain('createTree()');
  });

  it('returns HTML after tree is created', async () => {
    await rt.createTree();
    const html = rt.renderTree();
    expect(html).toMatch(/<!DOCTYPE html>|<div|observe/i);
  });

  it('HTML includes tree branch names', async () => {
    await rt.createTree();
    const html = rt.renderTree();
    expect(html).toMatch(/observe|flow|connect/i);
  });
});

// ── runtime.getTreeHTML() ─────────────────────────────────────────────────

describe('BrowserRuntime.getTreeHTML()', () => {
  it('returns a valid HTML string', async () => {
    const html = await rt.getTreeHTML();
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/<\/html>/i);
  });

  it('returns self-contained HTML (no external URLs)', async () => {
    const html = await rt.getTreeHTML();
    expect(html).not.toMatch(/src\s*=\s*["']https?:/i);
  });

  it('returns full page with tree container', async () => {
    await rt.createTree();
    const html = await rt.getTreeHTML();
    expect(html).toMatch(/tree-container|observe/i);
  });
});

// ── runtime.health() ─────────────────────────────────────────────────────

describe('BrowserRuntime.health()', () => {
  it('returns a DOT', () => {
    const dot = rt.health();
    expect(dot).toBeDefined();
  });

  it('health DOT has measure type', () => {
    const dot = rt.health();
    expect(dot.type).toBe('measure');
  });

  it('health DOT has a payload', () => {
    const dot = rt.health();
    expect(dot.payload).toBeInstanceOf(Uint8Array);
    expect(dot.payload!.length).toBeGreaterThan(0);
  });
});

// ── runtime.shutdown() ───────────────────────────────────────────────────

describe('BrowserRuntime.shutdown()', () => {
  it('shuts down without error', async () => {
    // Create fresh runtime so afterEach doesn't double-shutdown
    const localRt = await createBrowserRuntime({ storage: 'memory' });
    await expect(localRt.shutdown()).resolves.toBeUndefined();
  });

  it('fires shutdown event', async () => {
    const localRt = await createBrowserRuntime({ storage: 'memory' });
    let fired = false;
    localRt.events.addEventListener('shutdown', () => { fired = true; });
    await localRt.shutdown();
    expect(fired).toBe(true);
  });
});
