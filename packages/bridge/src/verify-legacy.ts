/**
 * verify-legacy.ts — Signature and chain verification for v0.3.0 DOTs.
 *
 * Uses @noble/ed25519 and @noble/hashes/sha2 (sha256) as specified by R854.
 */

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha2';
import { buildLegacySignedBytes, type LegacyDOT } from './reader.js';

/**
 * Verifies the Ed25519 signature of a single v0.3.0 DOT.
 *
 * Reconstructs the 89-byte signed message from the DOT's raw buffer and
 * verifies against the stored pubkey.
 *
 * @param dot - Parsed LegacyDOT (from readLegacyDOT or readLegacyDOTRaw)
 * @returns true if the signature is valid, false otherwise
 */
export async function verifyLegacy(dot: LegacyDOT): Promise<boolean> {
  const message = buildLegacySignedBytes(dot.raw);
  try {
    return await ed.verifyAsync(dot.signature, message, dot.pubkey);
  } catch {
    return false;
  }
}

/**
 * Computes the SHA-256 hash of a LegacyDOT's raw buffer.
 *
 * This is the value that the NEXT DOT in the chain must store as its chainHash.
 *
 * @param dot - Parsed LegacyDOT
 * @returns 32-byte SHA-256 hash of dot.raw
 */
export function hashLegacyDOT(dot: LegacyDOT): Uint8Array {
  return sha256(dot.raw);
}

/** Result of a chain verification pass. */
export interface ChainVerifyResult {
  /** Whether ALL checks passed. */
  valid: boolean;
  /** Human-readable error descriptions, one per failing check. */
  errors: string[];
}

/**
 * Verifies a sequence of v0.3.0 DOTs as a causal chain.
 *
 * For each DOT:
 * 1. Verifies the Ed25519 signature.
 * 2. For DOT[i] (i > 0): verifies that SHA-256(DOT[i-1].raw) === DOT[i].chainHash.
 *
 * All errors are collected without early-exit — the full chain is always checked.
 *
 * @param dots - Ordered array of parsed LegacyDOTs (oldest first)
 * @returns ChainVerifyResult with validity flag and collected errors
 */
export async function verifyLegacyChain(dots: LegacyDOT[]): Promise<ChainVerifyResult> {
  const errors: string[] = [];

  // Verify each DOT's signature and chain link
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]!;

    // Signature check
    const sigValid = await verifyLegacy(dot);
    if (!sigValid) {
      errors.push(`DOT[${i}]: Ed25519 signature verification failed`);
    }

    // Chain link check: SHA-256(prev.raw) must equal current.chainHash
    if (i > 0) {
      const prev = dots[i - 1]!;
      const expectedHash = sha256(prev.raw);
      if (!bytesEqual(expectedHash, dot.chainHash)) {
        errors.push(
          `DOT[${i}]: chainHash does not match SHA-256 of DOT[${i - 1}].raw`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Constant-time-ish byte array equality. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i]! ^ b[i]!);
  }
  return diff === 0;
}
