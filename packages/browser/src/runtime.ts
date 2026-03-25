/**
 * runtime.ts — Browser-compatible DOT runtime.
 *
 * Wraps @dot-protocol/script createRuntime() with browser-specific storage
 * and provides Tree operations and HTML generation without server round-trips.
 *
 * Uses EventTarget instead of Node.js EventEmitter.
 */

import { createRuntime } from '@dot-protocol/script';
import type { DotRuntime } from '@dot-protocol/script';
import type { DOT, Identity } from '@dot-protocol/core';
import { createTree, addLeaf } from '@dot-protocol/tree';
import type { Tree } from '@dot-protocol/tree';
import { renderTree } from '@dot-protocol/viewer';
import { treeToViewerTree } from './tree-adapter.js';
import type { DotStorage } from './storage/indexeddb.js';
import { MemoryStorage, IndexedDBStorage } from './storage/indexeddb.js';
import { generateSingleFile } from './single-file.js';

// ── Types ─────────────────────────────────────────────────────────────────

/** Config for createBrowserRuntime(). */
export interface BrowserRuntimeConfig {
  /** Storage backend. 'memory' for ephemeral, 'indexeddb' for persistent. Default: 'memory'. */
  storage?: 'memory' | 'indexeddb';
  /** Pre-existing Ed25519 identity. Auto-generated if omitted. */
  identity?: { publicKey: Uint8Array; secretKey: Uint8Array };
}

/** The browser DOT runtime handle. */
export interface BrowserRuntime {
  /** This runtime's Ed25519 identity. */
  readonly identity: Identity;

  /**
   * Creates a signed, chained DOT observation.
   * observe → chain → sign in correct order.
   */
  observe(payload?: unknown, opts?: { type?: string; plaintext?: boolean }): Promise<DOT>;

  /**
   * Creates a new 3-branch Tree (observe, flow, connect).
   * Replaces any previous tree state.
   */
  createTree(): Promise<Tree>;

  /**
   * Adds a leaf node under an existing parent node.
   * @param parentHash - Hash of parent node
   * @param content - Text content of the new leaf
   */
  addLeaf(parentHash: string, content: string): Promise<void>;

  /**
   * Renders the current tree as an HTML string (viewer fragment, not full page).
   * Returns an empty-tree message if no tree exists.
   */
  renderTree(): string;

  /**
   * Returns a complete self-contained HTML file representing the current tree state.
   * Suitable for saving as a standalone .html file.
   */
  getTreeHTML(): Promise<string>;

  /** Returns a health-measure DOT describing runtime state. */
  health(): DOT;

  /** Tears down the runtime and releases resources. */
  shutdown(): Promise<void>;

  /** The underlying storage backend (for advanced use). */
  readonly storage: DotStorage;

  /** The current Tree (null before createTree() is called). */
  readonly tree: Tree | null;

  /** EventTarget for observing runtime events. */
  readonly events: EventTarget;
}

// ── Implementation ────────────────────────────────────────────────────────

/**
 * Creates a browser-compatible DOT runtime.
 *
 * @example
 * const rt = await createBrowserRuntime({ storage: 'memory' });
 * const tree = await rt.createTree();
 * const root = tree.roots.get('observe')!;
 * await rt.addLeaf(root.hash, 'The ocean is warming');
 * const html = rt.renderTree();
 */
export async function createBrowserRuntime(
  config: BrowserRuntimeConfig = {},
): Promise<BrowserRuntime> {
  // Boot underlying script runtime
  const nodeRuntime: DotRuntime = await createRuntime({
    identity: config.identity,
  });

  // Create storage backend
  const storage: DotStorage =
    config.storage === 'indexeddb'
      ? new IndexedDBStorage('dot-protocol-browser')
      : new MemoryStorage();

  await storage.open();

  // Mutable tree state
  let tree: Tree | null = null;

  // Event bus
  const events = new EventTarget();

  const runtime: BrowserRuntime = {
    get identity() {
      return nodeRuntime.identity;
    },

    async observe(payload, opts) {
      const dot = await nodeRuntime.observe(payload, opts as Parameters<DotRuntime['observe']>[1]);
      // Store in backing storage
      const hash = bytesToHex(hashDotSync(dot));
      await storage.put(hash, dot);
      events.dispatchEvent(new CustomEvent('dot', { detail: { hash, dot } }));
      return dot;
    },

    async createTree() {
      tree = await createTree(nodeRuntime.identity);
      events.dispatchEvent(new CustomEvent('tree:created', { detail: { tree } }));
      return tree;
    },

    async addLeaf(parentHash: string, content: string) {
      if (!tree) throw new Error('BrowserRuntime: call createTree() first');
      const { leaf } = await addLeaf(tree, { parentHash, content, type: 'claim' });
      events.dispatchEvent(new CustomEvent('tree:leaf', { detail: { leaf } }));
    },

    renderTree() {
      if (!tree || tree.nodes.size === 0) {
        return '<div style="color:#71717a;padding:24px">No tree yet — call createTree() first.</div>';
      }
      const viewerTree = treeToViewerTree(tree);
      return renderTree(viewerTree);
    },

    async getTreeHTML() {
      return generateSingleFile({
        title: 'DOT Protocol — Browser Runtime',
        includeTree: true,
        includeSample: tree === null,
        _tree: tree ?? undefined,
      });
    },

    health() {
      return nodeRuntime.health();
    },

    async shutdown() {
      await nodeRuntime.shutdown();
      events.dispatchEvent(new CustomEvent('shutdown'));
    },

    get storage() {
      return storage;
    },

    get tree() {
      return tree;
    },

    get events() {
      return events;
    },
  };

  return runtime;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Simple synchronous hash for storage keys.
 * Uses a djb2-style hash as a fast key — NOT the protocol BLAKE3.
 * For storage indexing only.
 */
function hashDotSync(dot: DOT): Uint8Array {
  const payload = dot.payload ?? new Uint8Array(0);
  const time = dot.time?.utc ?? Date.now();
  const combined = new Uint8Array(payload.length + 8);
  combined.set(payload);
  // Append time bytes
  const view = new DataView(combined.buffer);
  view.setFloat64(payload.length, time, false);
  // 32-byte pseudo-hash for storage key
  const result = new Uint8Array(32);
  let h = 5381;
  for (let i = 0; i < combined.length; i++) {
    h = ((h << 5) + h + (combined[i] ?? 0)) >>> 0;
  }
  const dv = new DataView(result.buffer);
  dv.setUint32(0, h, false);
  dv.setUint32(4, h ^ 0xdeadbeef, false);
  dv.setUint32(8, (h >>> 16) | (time & 0xffff), false);
  dv.setUint32(12, time >>> 0, false);
  // Fill rest with counter bytes
  for (let i = 16; i < 32; i++) {
    result[i] = (h >>> (i % 4) * 8) & 0xff;
  }
  return result;
}
