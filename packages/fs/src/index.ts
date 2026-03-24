/**
 * @dot-protocol/fs — STCV-aware filesystem layer for the DOT Protocol.
 *
 * Every file write creates a signed, chained DOT tracking:
 *   - Content hash (verify base)
 *   - Ed25519 signature (sign base)
 *   - Timestamp (time base)
 *   - Causal chain linking all versions (chain base)
 *
 * The DOT chain is stored in a sidecar file alongside each managed file.
 */

// Backends
export type { FSBackend, StatResult } from './backends/interface.js';
export { MemoryFSBackend } from './backends/memory.js';
export { NodeFSBackend } from './backends/node.js';

// Core DotFS class
export { DotFS } from './dotfs.js';
export type { ReadResult, VerifyResult, ListEntry } from './dotfs.js';

// Sidecar utilities
export { sidecarPath, sidecarExists, writeSidecar, readSidecar } from './sidecar.js';

// Integrity utilities
export {
  checkIntegrity,
  detectTampering,
  createTamperingEventDOT,
} from './integrity.js';
export type { IntegrityReport, TamperingResult } from './integrity.js';

// Health statistics
export { computeHealth, health } from './health.js';
export type { HealthStats } from './health.js';
