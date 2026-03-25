/**
 * health.ts — Sync health DOT.
 *
 * syncHealth() produces a single measure DOT summarising the state of:
 *   - ChainReplicator (peers, lastSync, localTip, remoteTips)
 *   - OfflineQueue (pendingOffline, isOnline)
 *   - EphemeralManager (ephemeralActive, ephemeralExpired)
 */

import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { ChainReplicator } from './replicator.js';
import type { OfflineQueue } from './offline.js';
import type { EphemeralManager } from './ephemeral.js';
import type { MeshNode } from '@dot-protocol/mesh';

/**
 * Produce a health measure DOT for the sync layer.
 *
 * @param replicator - The ChainReplicator to inspect.
 * @param offline - The OfflineQueue to inspect.
 * @param ephemeral - The EphemeralManager to inspect.
 * @returns A DOT of type 'measure' with a JSON payload containing sync health fields.
 */
export function syncHealth(
  replicator: ChainReplicator,
  offline: OfflineQueue,
  ephemeral: EphemeralManager,
  node?: MeshNode,
): DOT {
  const replStatus = replicator.status();
  const ephStatus = ephemeral.status();

  const report = {
    peers: replStatus.peers,
    lastSync: replStatus.lastSync,
    localTip: replStatus.localTip,
    remoteTipCount: replStatus.remoteTips.size,
    replicatorRunning: replStatus.running,
    pendingOffline: offline.pending(),
    isOnline: node !== undefined ? offline.isOnline(node) : replStatus.peers > 0,
    ephemeralActive: ephStatus.active,
    ephemeralExpired: ephStatus.expired,
    ephemeralTotal: ephStatus.totalEphemeral,
    observed_at: new Date().toISOString(),
  };

  return observe(JSON.stringify(report), { type: 'measure', plaintext: true });
}
