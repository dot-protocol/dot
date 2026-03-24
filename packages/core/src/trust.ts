/**
 * trust.ts — Computed trust score for a DOT.
 *
 * Trust is computed (0.0 to ~3.0+), never enforced.
 * R854.1 trust formula: STCV base presence + FHE bonus + identity level + chain depth multiplier.
 *
 * Trust is a signal, not a gate. Higher trust = more independently verifiable observation.
 */

import type { DOT } from './types.js';

/**
 * Computes the trust score of a DOT based on R854.1 trust formula.
 *
 * Score components:
 * - sign.signature present: +0.20
 * - time.utc present: +0.10
 * - chain.previous present: +0.30
 * - verify.hash present: +0.20
 * - payload_mode === 'fhe': +0.10
 * - Identity level bonus (see IDENTITY_BONUSES)
 * - Chain depth multiplier: trust *= (1 + Math.log10(depth)) if depth > 1
 *
 * An empty DOT has trust 0.0.
 * A fully populated DOT with a deep chain can exceed 3.0.
 *
 * @param dot - The DOT to score
 * @returns Trust score (0.0 to ~3.0+)
 *
 * @example
 * computeTrust({}) // 0.0
 *
 * @example
 * // Signed DOT with time, chain, hash, FHE, real identity
 * computeTrust(fullDot) // > 1.0
 */
export function computeTrust(dot: DOT): number {
  let trust = 0.0;

  // S: signature present
  if (dot.sign?.signature !== undefined) {
    trust += 0.20;
  }

  // T: time.utc present
  if (dot.time?.utc !== undefined) {
    trust += 0.10;
  }

  // C: chain.previous present
  if (dot.chain?.previous !== undefined) {
    trust += 0.30;
  }

  // V: verify.hash present
  if (dot.verify?.hash !== undefined) {
    trust += 0.20;
  }

  // FHE encryption bonus
  if (dot.payload_mode === 'fhe') {
    trust += 0.10;
  }

  // Identity level bonus
  trust += identityBonus(dot.sign?.level);

  // Chain depth multiplier
  const depth = dot.chain?.depth;
  if (depth !== undefined && depth > 1) {
    trust *= (1 + Math.log10(depth));
  }

  return trust;
}

/** Identity disclosure level trust bonuses. */
const IDENTITY_BONUSES: Record<string, number> = {
  real: 0.10,
  pseudonymous: 0.07,
  anonymous: 0.03,
  ephemeral: 0.01,
  absent: 0.00,
};

/** Returns the trust bonus for a given identity level. */
function identityBonus(level: string | undefined): number {
  if (level === undefined) return 0.00;
  return IDENTITY_BONUSES[level] ?? 0.00;
}
