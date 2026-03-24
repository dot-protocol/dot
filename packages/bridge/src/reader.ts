/**
 * reader.ts — Parse v0.3.0 153-byte DOT wire format into LegacyDOT struct.
 *
 * v0.3.0 wire format (FIXED 153 bytes):
 *   [0..31]    32  pubkey     Ed25519 public key
 *   [32..95]   64  sig        Ed25519 signature over signed_bytes
 *   [96..127]  32  chain      SHA-256 of previous DOT (or 32 zeros for genesis)
 *   [128..135]  8  timestamp  Unix ms, big-endian int64
 *   [136]       1  type       0x00=PUBLIC, 0x01=CIRCLE, 0x02=PRIVATE, 0x03=EPHEMERAL
 *   [137..152] 16  payload    Zero-padded content
 *
 * signed_bytes = pubkey(32) + chain(32) + ts(8) + type(1) + payload(16) = 89 bytes
 */

import * as ed from '@noble/ed25519';

/** Size of a v0.3.0 DOT in bytes. */
export const LEGACY_DOT_SIZE = 153;

/** Visibility type byte constants. */
export const LEGACY_TYPE_PUBLIC = 0x00;
export const LEGACY_TYPE_CIRCLE = 0x01;
export const LEGACY_TYPE_PRIVATE = 0x02;
export const LEGACY_TYPE_EPHEMERAL = 0x03;

/** Human-readable visibility type names. */
export type LegacyVisibilityType = 'public' | 'circle' | 'private' | 'ephemeral';

/**
 * Parsed v0.3.0 DOT — all fields extracted from the 153-byte wire format.
 */
export interface LegacyDOT {
  /** Ed25519 public key of the signer (32 bytes). */
  pubkey: Uint8Array;
  /** Ed25519 signature (64 bytes). */
  signature: Uint8Array;
  /** SHA-256 of previous DOT (32 bytes; all zeros = genesis). */
  chainHash: Uint8Array;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
  /** Visibility type (decoded from byte). */
  visibilityType: LegacyVisibilityType;
  /** Payload bytes with trailing zeros stripped. */
  payload: Uint8Array;
  /** Original 153-byte raw buffer. */
  raw: Uint8Array;
}

/**
 * Builds the 89-byte signed message from a 153-byte raw DOT buffer.
 *
 * signed_bytes = pubkey[0..31] + raw[96..152]
 *              = pubkey(32) + chain(32) + ts(8) + type(1) + payload(16)
 *
 * @param raw - 153-byte raw DOT buffer
 * @returns 89-byte message that was signed
 */
export function buildLegacySignedBytes(raw: Uint8Array): Uint8Array {
  const msg = new Uint8Array(89);
  msg.set(raw.slice(0, 32), 0);   // pubkey
  msg.set(raw.slice(96, 153), 32); // chain + ts + type + payload
  return msg;
}

/**
 * Decodes the visibility type byte into a human-readable string.
 *
 * @param typeByte - The type byte from offset [136]
 * @throws If typeByte is not 0x00–0x03
 */
function decodeVisibilityType(typeByte: number): LegacyVisibilityType {
  switch (typeByte) {
    case LEGACY_TYPE_PUBLIC:    return 'public';
    case LEGACY_TYPE_CIRCLE:    return 'circle';
    case LEGACY_TYPE_PRIVATE:   return 'private';
    case LEGACY_TYPE_EPHEMERAL: return 'ephemeral';
    default:
      throw new Error(`Unknown v0.3.0 type byte: 0x${typeByte.toString(16).padStart(2, '0')}`);
  }
}

/**
 * Reads the timestamp from bytes [128..135] as a big-endian int64.
 *
 * @param raw - 153-byte raw DOT buffer
 * @returns Timestamp in milliseconds
 */
function readTimestamp(raw: Uint8Array): number {
  const view = new DataView(raw.buffer, raw.byteOffset + 128, 8);
  const hi = view.getUint32(0, false);
  const lo = view.getUint32(4, false);
  return hi * 0x100000000 + lo;
}

/**
 * Parses a 153-byte buffer into a LegacyDOT WITHOUT verifying the signature.
 * Use for trusted internal operations or when signature is checked separately.
 *
 * @param raw - Input buffer (must be exactly 153 bytes)
 * @throws If buffer is not exactly 153 bytes or type byte is unknown
 */
export function readLegacyDOTRaw(raw: Uint8Array): LegacyDOT {
  if (raw.length !== LEGACY_DOT_SIZE) {
    throw new Error(
      `v0.3.0 DOT must be exactly ${LEGACY_DOT_SIZE} bytes, got ${raw.length}`,
    );
  }

  const pubkey = raw.slice(0, 32);
  const signature = raw.slice(32, 96);
  const chainHash = raw.slice(96, 128);
  const timestamp = readTimestamp(raw);
  const typeByte = raw[136]!;
  const visibilityType = decodeVisibilityType(typeByte);
  const rawPayload = raw.slice(137, 153);
  const payload = trimTrailingZeros(rawPayload);

  return {
    pubkey,
    signature,
    chainHash,
    timestamp,
    visibilityType,
    payload,
    raw: raw.slice(), // copy to prevent external mutation
  };
}

/**
 * Parses a 153-byte buffer into a LegacyDOT AND verifies the Ed25519 signature.
 *
 * @param raw - Input buffer (must be exactly 153 bytes)
 * @throws If buffer is wrong size, type byte is unknown, or signature is invalid
 */
export async function readLegacyDOT(raw: Uint8Array): Promise<LegacyDOT> {
  const dot = readLegacyDOTRaw(raw);

  // Verify signature
  const message = buildLegacySignedBytes(raw);
  let valid: boolean;
  try {
    valid = await ed.verifyAsync(dot.signature, message, dot.pubkey);
  } catch {
    throw new Error('v0.3.0 DOT signature verification threw — malformed signature or key');
  }

  if (!valid) {
    throw new Error('v0.3.0 DOT signature verification failed — data may be tampered');
  }

  return dot;
}

/**
 * Trims trailing zero bytes from a Uint8Array.
 *
 * @param bytes - Input array
 * @returns New array with trailing zeros removed
 */
export function trimTrailingZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end--;
  }
  return bytes.slice(0, end);
}

/**
 * Returns true if the chainHash is the genesis sentinel (32 zero bytes).
 *
 * @param chainHash - 32-byte chain hash to check
 */
export function isGenesisChainHash(chainHash: Uint8Array): boolean {
  return chainHash.every((b) => b === 0);
}
