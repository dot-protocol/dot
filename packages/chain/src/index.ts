/**
 * @dot-protocol/chain — Merkle DAG with CRDT merge and pluggable storage.
 *
 * R854: Append-only causal chains of DOTs with content-addressed storage.
 */

// Storage
export type { StorageBackend, ListOptions } from './storage/interface.js';
export { MemoryStorage } from './storage/memory.js';
export { SQLiteStorage } from './storage/sqlite.js';

// DAG
export {
  createChain,
  append,
  walk,
  tip,
  root,
  depth,
  verify_chain,
  dotHashToHex,
  bufToHex,
  hexToBuf,
} from './dag.js';
export type { Chain, VerifyResult } from './dag.js';

// CRDT
export { detectFork, merge } from './crdt.js';
export type { ForkResult } from './crdt.js';

// Query
export { byHash, byTimeRange, byType, byObserver, byDepthRange } from './query.js';

// Health
export { health, checkAutoEmit, getMetaChain, clearMetaChains } from './health.js';
export type { HealthReport } from './health.js';
