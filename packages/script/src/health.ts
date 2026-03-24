/**
 * health.ts — Runtime health observation.
 *
 * runtimeHealth() returns a measure DOT describing the current state
 * of the runtime: uptime, DOTs created, chains active, memory usage, etc.
 */

import { observe as coreObserve } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { DotRuntime } from './runtime.js';

/** Shape of the health payload (plaintext JSON). */
export interface HealthPayload {
  /** Runtime uptime in milliseconds. */
  uptime_ms: number;
  /** Total DOTs created by the runtime. */
  dots_created: number;
  /** Number of active chains (always 1 for the identity chain). */
  chains_active: number;
  /** Number of connected mesh peers (0 if mesh disabled). */
  mesh_peers: number;
  /** Node.js heap used in bytes (0 in non-Node environments). */
  memory_heap_used: number;
  /** Depth of the identity chain (number of DOTs appended). */
  identity_chain_depth: number;
}

/**
 * Returns a health 'measure' DOT describing the runtime's current state.
 *
 * The DOT is created via the runtime's own observe() path so it is
 * signed and chained into the identity chain.
 *
 * @param runtime - The DotRuntime to inspect
 * @returns A signed, chained health DOT with plaintext payload
 *
 * @example
 * const rt = await createRuntime();
 * const h = runtimeHealth(rt);
 * // h.type === 'measure'
 * // h.payload contains JSON-encoded HealthPayload
 */
export function runtimeHealth(runtime: DotRuntime): DOT {
  return runtime.health();
}
