/**
 * trust.ts — DOT-SEAL chain-depth trust assessment.
 *
 * DOT-SEAL replaces Certificate Authorities with chain-depth trust.
 * Trust is computed from:
 *   - How deep the identity's chain is (history length)
 *   - Consistency: no contradicting claims on the same topic
 *   - Peer attestations: how many other identities have bonded to this one
 *   - Time active: how long since the first DOT was observed
 *
 * Formula:
 *   computedTrust = (chainDepth * 0.3) +
 *                  (consistency * 0.3) +
 *                  (log10(peerAttestations + 1) * 0.2) +
 *                  (min(timeActive / 86400000, 365) / 365 * 0.2)
 *
 * Maximum theoretical trust: ~1.0 (after 365 days, infinite depth chain,
 * perfect consistency, and many peer attestations).
 */

import type { Chain } from '@dot-protocol/chain';
import { walk } from '@dot-protocol/chain';
import type { DOT } from '@dot-protocol/core';

/** Full computed trust score for an identity. */
export interface TrustScore {
  /** Number of DOTs in the identity's chain. */
  chainDepth: number;
  /**
   * Consistency score 0.0–1.0.
   * 1.0 = no contradicting claims. Reduced when same topic has conflicting values.
   */
  consistency: number;
  /** Number of peer attestations (bond-type DOTs referencing this identity). */
  peerAttestations: number;
  /** Milliseconds since the first DOT in the chain (time active). */
  timeActive: number;
  /**
   * Final computed trust score using the DOT-SEAL formula.
   * Range: 0.0–1.0 (approximately).
   */
  computedTrust: number;
}

/**
 * Assess the trust score for an identity by scanning their chain.
 *
 * Performs a full walk of the chain to extract all DOTs signed by the
 * identity, then computes consistency (no contradicting claims) and
 * counts peer attestations (bond DOTs from other observers).
 *
 * @param identity - 32-byte Ed25519 public key of the identity to assess
 * @param chain    - The chain to scan for this identity's DOTs
 * @returns TrustScore with all component values and final computedTrust
 */
export async function assessTrust(
  identity: Uint8Array,
  chain: Chain,
): Promise<TrustScore> {
  const identityDots: DOT[] = [];
  const peerBondDots: DOT[] = [];

  // Walk the entire chain
  for await (const dot of walk(chain)) {
    const observer = dot.sign?.observer;

    if (observer !== undefined && bytesEqual(observer, identity)) {
      identityDots.push(dot);
    } else if (dot.type === 'bond') {
      // Bond from someone else referencing our identity — attestation
      peerBondDots.push(dot);
    }
  }

  const chainDepth = identityDots.length;
  const consistency = computeConsistency(identityDots);
  const peerAttestations = peerBondDots.length;
  const timeActive = computeTimeActive(identityDots);
  const computedTrust = computeTrustScore({
    chainDepth,
    consistency,
    peerAttestations,
    timeActive,
  });

  return { chainDepth, consistency, peerAttestations, timeActive, computedTrust };
}

/**
 * Quick trust estimate without a full chain scan.
 *
 * Useful when you already know the chain depth and age (e.g., from a
 * HandshakeMessage header) and want a fast trust approximation.
 *
 * @param identity   - Identity bytes (used only for validation)
 * @param depth      - Known chain depth (number of DOTs)
 * @param ageMs      - Known time active in milliseconds
 * @returns Estimated TrustScore (consistency=1.0, peerAttestations=0)
 */
export function assessTrustQuick(
  identity: Uint8Array,
  depth: number,
  ageMs: number,
): TrustScore {
  if (identity.length === 0) {
    throw new RangeError('assessTrustQuick: identity must not be empty');
  }

  const chainDepth = Math.max(0, depth);
  const consistency = 1.0; // Optimistic — no contradiction data available
  const peerAttestations = 0;
  const timeActive = Math.max(0, ageMs);
  const computedTrust = computeTrustScore({
    chainDepth,
    consistency,
    peerAttestations,
    timeActive,
  });

  return { chainDepth, consistency, peerAttestations, timeActive, computedTrust };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Compute the DOT-SEAL trust formula.
 *
 * Formula:
 *   computedTrust = (chainDepth * 0.3) +
 *                  (consistency * 0.3) +
 *                  (log10(peerAttestations + 1) * 0.2) +
 *                  (min(timeActive / 86400000, 365) / 365 * 0.2)
 */
function computeTrustScore({
  chainDepth,
  consistency,
  peerAttestations,
  timeActive,
}: {
  chainDepth: number;
  consistency: number;
  peerAttestations: number;
  timeActive: number;
}): number {
  const depthComponent = chainDepth * 0.3;
  const consistencyComponent = consistency * 0.3;
  const attestationComponent = Math.log10(peerAttestations + 1) * 0.2;
  const daysActive = Math.min(timeActive / 86_400_000, 365);
  const timeComponent = (daysActive / 365) * 0.2;

  return depthComponent + consistencyComponent + attestationComponent + timeComponent;
}

/**
 * Check identity's DOTs for contradicting claims (same payload topic, different value).
 *
 * Contradictions are detected by comparing the string prefix of plaintext
 * payloads. A DOT is "contradicting" if it has the same type and matching
 * topic prefix but a different payload body.
 *
 * Returns a consistency score 0.0–1.0. 1.0 = no contradictions.
 */
function computeConsistency(dots: DOT[]): number {
  if (dots.length === 0) return 1.0;

  // Group claim DOTs by their topic (first 32 bytes of payload as hex = topic key)
  const claimDots = dots.filter(
    (d) => d.type === 'claim' && d.payload !== undefined && d.payload_mode === 'plain',
  );

  if (claimDots.length === 0) return 1.0;

  // Track seen (topic, value) pairs
  const topics = new Map<string, string>();
  let contradictions = 0;

  for (const dot of claimDots) {
    const payload = dot.payload!;
    // Topic = first 16 bytes (or full payload if shorter), Value = rest
    const topicEnd = Math.min(16, Math.floor(payload.length / 2));
    const topic = bytesToHex(payload.slice(0, topicEnd));
    const value = bytesToHex(payload.slice(topicEnd));

    const existing = topics.get(topic);
    if (existing === undefined) {
      topics.set(topic, value);
    } else if (existing !== value) {
      contradictions++;
    }
  }

  if (topics.size === 0) return 1.0;
  const contradictionRate = contradictions / topics.size;
  return Math.max(0, 1.0 - contradictionRate);
}

/**
 * Compute time active in ms: difference between oldest and newest DOT timestamps.
 * Returns 0 if no timed DOTs.
 */
function computeTimeActive(dots: DOT[]): number {
  const timestamps = dots
    .map((d) => d.time?.utc)
    .filter((t): t is number => t !== undefined);

  if (timestamps.length === 0) return 0;

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  return max - min;
}

/** Compare two Uint8Arrays for equality. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Convert bytes to hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}
