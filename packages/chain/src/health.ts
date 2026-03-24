/**
 * health.ts — Chain health monitoring.
 *
 * health() produces a DOT of type 'measure' whose payload is a HealthReport JSON.
 * checkAutoEmit() auto-emits health DOTs into a per-chain meta chain every 100 appends.
 * getMetaChain() retrieves the meta chain for a given chain ID.
 * clearMetaChains() resets all meta chains (for test isolation).
 */

import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createChain, append, verify_chain, type Chain } from './dag.js';
import { MemoryStorage } from './storage/memory.js';

/** Structured payload of a health DOT. */
export interface HealthReport {
  /** Chain ID this health report is for. */
  chain_id: string;
  /** Total number of DOTs in the chain (from storage count). */
  total: number;
  /** Number of DOTs that passed causal verification. */
  verified: number;
  /** Percentage of verified DOTs (0–100). */
  verified_pct: number;
  /** Whether the full chain is valid (no errors). */
  valid: boolean;
  /** List of integrity errors, if any. */
  errors: string[];
  /** Name of the storage backend. */
  storage_backend: string;
  /** Total appends ever recorded (monotonically increasing). */
  append_count: number;
  /** ISO 8601 timestamp when this health DOT was observed. */
  observed_at: string;
}

/**
 * Produce a health DOT for the given chain.
 *
 * The DOT has:
 * - type: 'measure'
 * - payload_mode: 'plain'
 * - payload: JSON-encoded HealthReport
 */
export function health(chain: Chain): DOT {
  const verifyResult = verify_chain(chain);
  const total = chain.storage.count();
  const verifiedPct = total === 0 ? 100 : Math.round((verifyResult.verified / total) * 100);

  const report: HealthReport = {
    chain_id: chain.id,
    total,
    verified: verifyResult.verified,
    verified_pct: verifiedPct,
    valid: verifyResult.valid,
    errors: verifyResult.errors,
    storage_backend: chain.storage.name,
    append_count: chain.appendCount,
    observed_at: new Date().toISOString(),
  };

  return observe(JSON.stringify(report), { type: 'measure', plaintext: true });
}

// --- Meta chain registry (module-level singleton for auto-emit) ---

const metaChains = new Map<string, Chain>();

/**
 * Check if an auto-emit should happen and if so, append a health DOT to the
 * chain's meta chain.
 *
 * Auto-emits when appendCount is a positive multiple of 100.
 *
 * @returns The updated meta chain if auto-emit triggered, or null otherwise.
 */
export function checkAutoEmit(chain: Chain): Chain | null {
  if (chain.appendCount === 0 || chain.appendCount % 100 !== 0) {
    return null;
  }

  const metaId = chain.id + '._meta';
  const existing = metaChains.get(chain.id) ?? createChain(new MemoryStorage(), metaId);

  const healthDot = health(chain);
  const updated = append(existing, healthDot);
  metaChains.set(chain.id, updated);

  return updated;
}

/**
 * Retrieve the meta chain for a given chain ID.
 *
 * @returns The meta chain, or null if no auto-emit has occurred yet.
 */
export function getMetaChain(chainId: string): Chain | null {
  return metaChains.get(chainId) ?? null;
}

/**
 * Clear all meta chains. Used for test isolation.
 */
export function clearMetaChains(): void {
  metaChains.clear();
}
