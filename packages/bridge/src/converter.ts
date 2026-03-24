/**
 * converter.ts — Convert v0.3.0 LegacyDOT → R854 DOT.
 *
 * Field mapping:
 *   pubkey           → sign.observer
 *   signature        → sign.signature  (PRESERVED — same bytes)
 *   timestamp        → time.utc
 *   payload          → payload (trailing zeros already stripped by reader)
 *   visibilityType   → type (PUBLIC/CIRCLE/PRIVATE → 'claim', EPHEMERAL → 'event')
 *   chainHash        → chain.previous:
 *                       - all-zeros (genesis) → 32-byte zero array, depth=0
 *                       - non-zero → 33-byte legacy chain ref (LEGACY_HASH_PREFIX + hash), depth=1
 *
 * The legacy signature is PRESERVED even though it was signed over legacy canonical bytes,
 * not R854 canonical bytes. The bridge DOT serves as the authoritative link.
 */

import type { DOT, ObservationType } from '@dot-protocol/core';
import { type LegacyDOT, isGenesisChainHash } from './reader.js';

/**
 * Prefix byte that marks a chain.previous value as a legacy SHA-256 chain ref.
 * Value: 0x01 (distinguishes from raw BLAKE3 hashes used in R854).
 */
export const LEGACY_HASH_PREFIX = 0x01;

/**
 * Encodes a 32-byte legacy SHA-256 hash into a 33-byte tagged chain reference.
 *
 * Format: [LEGACY_HASH_PREFIX(1)] + [sha256_hash(32)]
 *
 * @param hash - 32-byte SHA-256 hash to encode
 * @returns 33-byte legacy chain reference
 */
export function encodeLegacyChainRef(hash: Uint8Array): Uint8Array {
  const ref = new Uint8Array(33);
  ref[0] = LEGACY_HASH_PREFIX;
  ref.set(hash, 1);
  return ref;
}

/**
 * Returns true if the given bytes are a legacy chain reference (33 bytes, first byte = LEGACY_HASH_PREFIX).
 *
 * @param bytes - Bytes to check
 */
export function isLegacyChainRef(bytes: Uint8Array): boolean {
  return bytes.length === 33 && bytes[0] === LEGACY_HASH_PREFIX;
}

/**
 * Extracts the 32-byte SHA-256 hash from a 33-byte legacy chain reference.
 *
 * @param ref - 33-byte legacy chain reference (as returned by encodeLegacyChainRef)
 * @returns 32-byte SHA-256 hash
 */
export function extractLegacyHash(ref: Uint8Array): Uint8Array {
  return ref.slice(1, 33);
}

/**
 * Maps a legacy visibility type string to an R854 ObservationType.
 *
 * Mapping:
 *   'public'    → 'claim'  (public observations = claims)
 *   'circle'    → 'claim'  (circle-visible = semi-private claims)
 *   'private'   → 'claim'  (private = personal claims)
 *   'ephemeral' → 'event'  (ephemeral = transient events)
 *
 * @throws If visibilityType is unrecognized
 */
function mapVisibilityType(visibilityType: LegacyDOT['visibilityType']): ObservationType {
  switch (visibilityType) {
    case 'public':
    case 'circle':
    case 'private':
      return 'claim';
    case 'ephemeral':
      return 'event';
    default: {
      // TypeScript exhaustive check — will throw at runtime for unknown strings
      const _exhaustive: never = visibilityType;
      throw new Error(`Unknown legacy visibility type: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Converts a single v0.3.0 LegacyDOT into an R854 DOT.
 *
 * @param legacy - Parsed LegacyDOT (from readLegacyDOT)
 * @returns R854-compatible DOT with legacy fields mapped
 * @throws If visibilityType is unrecognized
 */
export function convertDOT(legacy: LegacyDOT): DOT {
  // Build chain.previous:
  //   - Genesis: 32 zero bytes, depth 0
  //   - Non-genesis: 33-byte tagged legacy chain ref, depth 1
  const isGenesis = isGenesisChainHash(legacy.chainHash);
  const chainPrevious = isGenesis
    ? new Uint8Array(32)
    : encodeLegacyChainRef(legacy.chainHash);
  const chainDepth = isGenesis ? 0 : 1;

  // Build payload fields
  const hasPayload = legacy.payload.length > 0;

  const dot: DOT = {
    // Sign base — signature PRESERVED (same bytes, not re-signed)
    sign: {
      observer: legacy.pubkey,
      signature: legacy.signature,
    },
    // Time base
    time: {
      utc: legacy.timestamp,
    },
    // Chain base
    chain: {
      previous: chainPrevious,
      depth: chainDepth,
    },
    // Type mapping
    type: mapVisibilityType(legacy.visibilityType),
  };

  // Payload (only set when non-empty)
  if (hasPayload) {
    dot.payload = legacy.payload;
    dot.payload_mode = 'plain';
  } else {
    dot.payload_mode = 'none';
  }

  return dot;
}

/**
 * Converts an ordered array of v0.3.0 LegacyDOTs to R854 DOTs.
 *
 * Preserves ordering. Does not handle errors — use batchConvert for fault-tolerant conversion.
 *
 * @param dots - Ordered array of parsed LegacyDOTs
 * @returns Array of R854 DOTs in the same order
 */
export function convertChain(dots: LegacyDOT[]): DOT[] {
  return dots.map((d) => convertDOT(d));
}
