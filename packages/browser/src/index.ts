/**
 * @dot-protocol/browser — DOT Protocol browser distribution.
 *
 * Provides:
 * - BrowserRuntime: client-side DOT runtime (no server needed)
 * - IndexedDBStorage / MemoryStorage: browser-compatible storage
 * - generateSingleFile(): produces a complete self-contained HTML distribution
 * - inlineCryptoScript(): minimal browser crypto (Web Crypto API based)
 *
 * The single-file HTML is the primary deliverable:
 * "One HTML file. Under 100KB. No server. No signup. A child opens it."
 *
 * @example
 * import { generateSingleFile } from '@dot-protocol/browser';
 * const html = await generateSingleFile({ title: 'My DOT Tree' });
 * // Write html to dot-tree.html — open in any browser
 */

// Runtime
export { createBrowserRuntime } from './runtime.js';
export type { BrowserRuntime, BrowserRuntimeConfig } from './runtime.js';

// Storage
export { IndexedDBStorage, MemoryStorage } from './storage/indexeddb.js';
export type { DotStorage } from './storage/indexeddb.js';

// Single-file distribution
export { generateSingleFile } from './single-file.js';
export type { SingleFileOptions } from './single-file.js';

// Inline scripts (for embedding or testing)
export { inlineCryptoScript } from './inline-crypto.js';
export { appScript } from './app-script.js';

// Tree adapter (ViewerTree ↔ Tree conversion)
export { treeToViewerTree } from './tree-adapter.js';

