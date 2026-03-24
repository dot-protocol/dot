/**
 * verify() — check the integrity of a DOT.
 *
 * R854.1 Correction #47: An unsigned DOT is VALID. Absence of a signature
 * does not constitute an error — it means trust score is simply lower.
 * Only present fields are checked.
 */

import * as ed from '@noble/ed25519';
import { createHash } from './hash.js';
import { buildSignedBytes } from './sign.js';
import type { DOT } from './types.js';

/** Result of a DOT verification check. */
export interface VerifyResult {
  /** Whether all present checks passed. True for unsigned DOTs per Correction #47. */
  valid: boolean;
  /** Human-readable reason when valid is false, or a note when valid is true. */
  reason?: string;
  /** List of checks that were actually performed. */
  checked: string[];
}

/**
 * Verifies the integrity of a DOT.
 *
 * Checks are only performed for fields that are actually present:
 * - If sign.signature is present → verify Ed25519 signature
 * - If verify.hash is present → recompute BLAKE3 and compare
 *
 * An unsigned DOT (no signature) is VALID per R854.1 Correction #47.
 *
 * @param dot - The DOT to verify
 * @returns Verification result with validity flag, optional reason, and list of checks performed
 *
 * @example
 * const unsigned = observe('hello');
 * const result = verify(unsigned);
 * // result.valid === true (unsigned DOTs are valid)
 * // result.checked === [] (nothing to check)
 *
 * @example
 * const signed = await sign(observe('hello'), secretKey);
 * const result = await verify(signed);
 * // result.valid === true
 * // result.checked === ['signature']
 */
export async function verify(dot: DOT): Promise<VerifyResult> {
  const checked: string[] = [];

  // If no signature present → valid per Correction #47
  if (dot.sign?.signature === undefined || dot.sign?.observer === undefined) {
    // Still check hash if present
    if (dot.verify?.hash !== undefined && dot.payload !== undefined) {
      const hashResult = await verifyHash(dot);
      if (!hashResult.valid) {
        return { valid: false, reason: hashResult.reason, checked: ['hash'] };
      }
      checked.push('hash');
    }
    return {
      valid: true,
      reason: 'unsigned DOT is valid per Correction #47',
      checked,
    };
  }

  // Verify Ed25519 signature
  const message = buildSignedBytes(dot);
  let sigValid: boolean;
  try {
    sigValid = await ed.verifyAsync(dot.sign.signature, message, dot.sign.observer);
  } catch {
    return {
      valid: false,
      reason: 'signature verification threw an error — malformed signature or key',
      checked: ['signature'],
    };
  }

  if (!sigValid) {
    return {
      valid: false,
      reason: 'Ed25519 signature verification failed',
      checked: ['signature'],
    };
  }
  checked.push('signature');

  // Verify payload hash if present
  if (dot.verify?.hash !== undefined && dot.payload !== undefined) {
    const hashResult = await verifyHash(dot);
    if (!hashResult.valid) {
      return { valid: false, reason: hashResult.reason, checked: [...checked, 'hash'] };
    }
    checked.push('hash');
  }

  // Verify chain link (structural check — previous is 32 bytes)
  if (dot.chain?.previous !== undefined) {
    if (dot.chain.previous.length !== 32) {
      return {
        valid: false,
        reason: 'chain.previous must be exactly 32 bytes',
        checked: [...checked, 'chain'],
      };
    }
    checked.push('chain');
  }

  return { valid: true, checked };
}

/** Internal: verify payload hash. */
async function verifyHash(dot: DOT): Promise<{ valid: boolean; reason?: string }> {
  if (dot.verify?.hash === undefined || dot.payload === undefined) {
    return { valid: true };
  }
  const computed = await createHash(dot.payload);
  if (!bytesEqual(computed, dot.verify.hash)) {
    return { valid: false, reason: 'verify.hash does not match payload — payload may be tampered' };
  }
  return { valid: true };
}

/** Compare two Uint8Arrays for equality. */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
