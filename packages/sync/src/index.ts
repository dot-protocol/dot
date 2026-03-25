/**
 * @dot-protocol/sync — Chain replication over mesh, offline-first, ephemeral DOTs.
 *
 * R855 Phase 4: Trisolaran Fixes — multi-device chain replication + offline-first.
 */

// Replicator
export { ChainReplicator } from './replicator.js';
export type { ReplicatorConfig, SyncResult, ReplicatorStatus, ConflictStrategy } from './replicator.js';

// Offline
export { OfflineQueue } from './offline.js';
export type { FlushResult } from './offline.js';

// Ephemeral
export { EphemeralManager } from './ephemeral.js';
export type { EphemeralConfig, EphemeralDOT } from './ephemeral.js';

// Health
export { syncHealth } from './health.js';
