/**
 * health.ts — Mesh node health monitoring and partition detection.
 *
 * health(node)           — produce a measure DOT describing the node's state.
 * detectPartition(node)  — detect if peer count dropped >50% (likely partition).
 * startMonitor(node, ms) — emit health DOTs on an interval.
 */

import type { DOT } from '@dot-protocol/core';
import type { MeshNode } from './node.js';

/** Shape of the health DOT's JSON payload. */
export interface MeshHealthReport {
  /** This node's ID (hex public key). */
  node_id: string;
  /** Current number of connected peers. */
  peer_count: number;
  /** Total DOTs stored locally. */
  dots_stored: number;
  /** Number of DOTs broadcast. */
  dots_broadcast: number;
  /** Request success rate 0–1. */
  request_success_rate: number;
  /** Total unique hashes seen (dedup set size). */
  seen_hashes: number;
  /** ISO 8601 timestamp. */
  observed_at: string;
}

/** Handle returned by startMonitor. */
export interface MonitorHandle {
  running: boolean;
  _intervalId: ReturnType<typeof setInterval>;
}

// Track historical peer counts per node for partition detection
const peerCountHistory = new Map<string, number[]>();
const HISTORY_WINDOW = 5; // last N observations
const PARTITION_THRESHOLD = 0.5; // >50% drop

/**
 * Produce a health-measure DOT for the given MeshNode.
 *
 * Reads the node's health() method which returns a measure DOT with
 * a JSON payload of type MeshHealthReport.
 */
export function health(node: MeshNode): DOT {
  return node.health();
}

/**
 * Detect if the node is likely experiencing a network partition.
 *
 * A partition is suspected when the current peer count has dropped
 * more than 50% compared to the maximum observed in the recent history window.
 *
 * @returns true if a partition is suspected, false otherwise.
 */
export function detectPartition(node: MeshNode): boolean {
  const currentPeerCount = node.peers.size;
  const nodeId = node.id;

  const history = peerCountHistory.get(nodeId) ?? [];
  history.push(currentPeerCount);

  // Keep only the last HISTORY_WINDOW observations
  if (history.length > HISTORY_WINDOW) {
    history.splice(0, history.length - HISTORY_WINDOW);
  }
  peerCountHistory.set(nodeId, history);

  if (history.length < 2) return false;

  const maxSeen = Math.max(...history.slice(0, -1)); // max excluding current
  if (maxSeen === 0) return false;

  const dropRatio = (maxSeen - currentPeerCount) / maxSeen;
  return dropRatio > PARTITION_THRESHOLD;
}

/**
 * Clear partition detection history (for test isolation).
 */
export function clearPartitionHistory(): void {
  peerCountHistory.clear();
}

/**
 * Start a health monitor that emits a health DOT at regular intervals.
 *
 * The health DOT is appended to the node's local store and can be observed
 * by any handler registered with node.onDot().
 *
 * @param node       - The node to monitor.
 * @param intervalMs - Emit interval in milliseconds (default 5000ms).
 * @returns A MonitorHandle that can be used to stop the monitor.
 */
export function startMonitor(node: MeshNode, intervalMs = 5000): MonitorHandle {
  const handle: MonitorHandle = {
    running: true,
    _intervalId: setInterval(() => {
      if (!handle.running) return;
      const dot = health(node);
      node.store(dot);
    }, intervalMs),
  };

  return handle;
}

/**
 * Stop a health monitor.
 */
export function stopMonitor(handle: MonitorHandle): void {
  handle.running = false;
  clearInterval(handle._intervalId);
}
