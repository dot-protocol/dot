/**
 * safe.ts — Result-returning wrappers for critical DOT Protocol functions.
 *
 * R855: Every function that can fail returns Result<T, DOTError>.
 * These are additive — existing throwing functions are not modified.
 *
 * Functions:
 *   safeVerify  — wraps verify()
 *   safeSign    — wraps sign()
 *   safeDecode  — wraps fromBytes()
 *   safeHash    — wraps hash()
 */

import { verify } from './verify.js';
import type { VerifyResult } from './verify.js';
import { sign } from './sign.js';
import { fromBytes } from './encode.js';
import { hash } from './chain.js';
import type { DOT, UnsignedDOT } from './types.js';
import { ok, err } from './result.js';
import type { Result, DOTError } from './result.js';

/**
 * Safely verify a DOT's integrity, returning Result instead of throwing.
 *
 * Error codes:
 *   VERIFY_FAILED — signature check failed or internal crypto error
 *
 * @param dot - The DOT to verify
 * @returns Result<VerifyResult, DOTError>
 */
export async function safeVerify(dot: DOT): Promise<Result<VerifyResult, DOTError>> {
  try {
    const result = await verify(dot);
    if (!result.valid) {
      return err<DOTError>({
        code: 'VERIFY_FAILED',
        message: result.reason ?? 'Verification failed',
        source: 'safeVerify',
        details: { checked: result.checked },
      });
    }
    return ok(result);
  } catch (e) {
    return err<DOTError>({
      code: 'VERIFY_FAILED',
      message: e instanceof Error ? e.message : 'Unknown error during verification',
      source: 'safeVerify',
      details: e,
    });
  }
}

/**
 * Safely sign a DOT, returning Result instead of throwing.
 *
 * Validates that the secret key is exactly 32 bytes before attempting to sign.
 *
 * Error codes:
 *   SIGN_INVALID_KEY — secret key is not 32 bytes
 *   SIGN_FAILED      — crypto operation failed
 *
 * @param dot - The unsigned DOT to sign
 * @param secretKey - 32-byte Ed25519 secret key
 * @returns Result<DOT, DOTError>
 */
export async function safeSign(
  dot: UnsignedDOT,
  secretKey: Uint8Array,
): Promise<Result<DOT, DOTError>> {
  // Validate key length upfront
  if (secretKey.length !== 32) {
    return err<DOTError>({
      code: 'SIGN_INVALID_KEY',
      message: `Ed25519 secret key must be 32 bytes, got ${secretKey.length}`,
      source: 'safeSign',
      details: { keyLength: secretKey.length },
    });
  }

  try {
    const signed = await sign(dot, secretKey);
    return ok(signed);
  } catch (e) {
    return err<DOTError>({
      code: 'SIGN_FAILED',
      message: e instanceof Error ? e.message : 'Unknown error during signing',
      source: 'safeSign',
      details: e,
    });
  }
}

/**
 * Safely decode a DOT from TLV bytes, returning Result instead of throwing.
 *
 * Error codes:
 *   DECODE_TRUNCATED  — TLV header is incomplete (buffer ends mid-header)
 *   DECODE_MALFORMED  — TLV framing error (declared length exceeds buffer, or other parse error)
 *
 * An empty byte array decodes to an empty DOT `{}` — that is a success, not an error.
 *
 * @param bytes - Encoded DOT bytes
 * @returns Result<DOT, DOTError>
 */
export function safeDecode(bytes: Uint8Array): Result<DOT, DOTError> {
  try {
    const dot = fromBytes(bytes);
    return ok(dot);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown decode error';
    // Distinguish truncated from generally malformed based on error message
    const code = message.toLowerCase().includes('incomplete') ? 'DECODE_TRUNCATED' : 'DECODE_MALFORMED';
    return err<DOTError>({
      code,
      message,
      source: 'safeDecode',
      details: e,
    });
  }
}

/**
 * Safely compute the BLAKE3 hash of a DOT, returning Result instead of throwing.
 *
 * Error codes:
 *   HASH_FAILED — unexpected error during hashing
 *
 * @param dot - The DOT to hash
 * @returns Result<Uint8Array, DOTError> — 32-byte BLAKE3 digest on success
 */
export function safeHash(dot: DOT): Result<Uint8Array, DOTError> {
  try {
    const digest = hash(dot);
    return ok(digest);
  } catch (e) {
    return err<DOTError>({
      code: 'HASH_FAILED',
      message: e instanceof Error ? e.message : 'Unknown error during hashing',
      source: 'safeHash',
      details: e,
    });
  }
}
