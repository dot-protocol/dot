/**
 * sign() — apply an Ed25519 signature to an unsigned DOT.
 *
 * Signs the canonical representation of the DOT's observable fields.
 * Uses @noble/ed25519 async API (signAsync).
 */

import * as ed from '@noble/ed25519';
import { type DOT, type UnsignedDOT, computeLevel } from './types.js';

/**
 * Builds the canonical byte representation to be signed.
 *
 * Concatenates available fields in deterministic order:
 * payload | time.utc | time.monotonic | chain.previous | type
 *
 * Missing fields are skipped — partial DOTs are valid per Correction #47.
 *
 * @param dot - The DOT (or UnsignedDOT) to build signed bytes from
 * @returns Canonical bytes for signing/verification
 */
export function buildSignedBytes(dot: UnsignedDOT | DOT): Uint8Array {
  const parts: Uint8Array[] = [];

  // Payload
  if (dot.payload !== undefined && dot.payload.length > 0) {
    parts.push(dot.payload);
  }

  // time.utc as 8-byte big-endian
  if (dot.time?.utc !== undefined) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    // Store as two 32-bit parts since DataView doesn't support 64-bit natively
    const hi = Math.floor(dot.time.utc / 0x100000000);
    const lo = dot.time.utc >>> 0;
    view.setUint32(0, hi, false);
    view.setUint32(4, lo, false);
    parts.push(new Uint8Array(buf));
  }

  // time.monotonic as 8-byte big-endian
  if (dot.time?.monotonic !== undefined) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    const hi = Math.floor(dot.time.monotonic / 0x100000000);
    const lo = dot.time.monotonic >>> 0;
    view.setUint32(0, hi, false);
    view.setUint32(4, lo, false);
    parts.push(new Uint8Array(buf));
  }

  // chain.previous (32 bytes)
  if (dot.chain?.previous !== undefined) {
    parts.push(dot.chain.previous);
  }

  // type as a single ASCII byte
  if (dot.type !== undefined) {
    parts.push(new TextEncoder().encode(dot.type));
  }

  // Concatenate all parts
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * Signs an unsigned DOT with an Ed25519 secret key.
 *
 * Derives the public key from the secret key, builds the canonical signed bytes,
 * and produces an Ed25519 signature. Returns a new DOT with sign.observer and
 * sign.signature populated.
 *
 * @param dot - The unsigned DOT to sign (not mutated)
 * @param secretKey - 32-byte Ed25519 secret key
 * @returns A new signed DOT
 *
 * @example
 * const { publicKey, secretKey } = await createIdentity();
 * const unsigned = observe('hello world');
 * const signed = await sign(unsigned, secretKey);
 * // signed.sign.signature is now populated
 */
export async function sign(dot: UnsignedDOT, secretKey: Uint8Array): Promise<DOT> {
  const start = performance.now();

  // Derive public key from secret key
  const publicKey = await ed.getPublicKeyAsync(secretKey);

  // Build canonical bytes to sign
  const message = buildSignedBytes(dot);

  // Sign with Ed25519
  const signature = await ed.signAsync(message, secretKey);

  // Build result DOT, preserving all existing fields
  const result: DOT = {
    ...dot,
    sign: {
      ...dot.sign,
      observer: publicKey,
      signature,
    },
  };

  // Update meta
  const duration_us = (performance.now() - start) * 1000;
  result._meta = {
    ...result._meta,
    duration_us,
    level: computeLevel(result),
  };

  return result;
}
