/**
 * Test helpers — build valid v0.3.0 153-byte DOTs from scratch.
 *
 * v0.3.0 wire format:
 *   [0..31]    32  pubkey     Ed25519 public key
 *   [32..95]   64  sig        Ed25519 signature over bytes [0..31]+[96..152]
 *   [96..127]  32  chain      SHA-256 of previous DOT (or 32 zeros for genesis)
 *   [128..135]  8  ts         Unix ms, big-endian int64
 *   [136]       1  type       0x00=PUBLIC, 0x01=CIRCLE, 0x02=PRIVATE, 0x03=EPHEMERAL
 *   [137..152] 16  payload    Zero-padded content
 */

import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';

export interface LegacyKeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

/** Generates a fresh Ed25519 keypair for tests. */
export async function genKeyPair(): Promise<LegacyKeyPair> {
  const secretKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  return { secretKey, publicKey };
}

/**
 * Builds a 153-byte v0.3.0 DOT and signs it.
 *
 * @param kp - Signing keypair
 * @param opts - Optional overrides
 */
export async function buildLegacyDOT(
  kp: LegacyKeyPair,
  opts: {
    chainHash?: Uint8Array;  // 32 bytes, default = 32 zeros
    timestamp?: number;       // default = Date.now()
    type?: number;            // 0x00–0x03, default = 0x00
    payload?: Uint8Array;     // up to 16 bytes, zero-padded
  } = {},
): Promise<Uint8Array> {
  const buf = new Uint8Array(153);

  // [0..31] pubkey
  buf.set(kp.publicKey, 0);

  // [96..127] chainHash
  const chainHash = opts.chainHash ?? new Uint8Array(32);
  buf.set(chainHash, 96);

  // [128..135] timestamp as big-endian int64
  const ts = opts.timestamp ?? Date.now();
  const tsBuf = new ArrayBuffer(8);
  const tsView = new DataView(tsBuf);
  const hi = Math.floor(ts / 0x100000000);
  const lo = ts >>> 0;
  tsView.setUint32(0, hi, false);
  tsView.setUint32(4, lo, false);
  buf.set(new Uint8Array(tsBuf), 128);

  // [136] type byte
  buf[136] = opts.type ?? 0x00;

  // [137..152] payload, zero-padded to 16 bytes
  if (opts.payload !== undefined) {
    const payloadBytes = opts.payload.slice(0, 16);
    buf.set(payloadBytes, 137);
  }

  // Build signed message: pubkey (0–31) + bytes 96–152
  const message = new Uint8Array(89);
  message.set(buf.slice(0, 32), 0);
  message.set(buf.slice(96, 153), 32);

  // [32..95] signature
  const sig = await ed.signAsync(message, kp.secretKey);
  buf.set(sig, 32);

  return buf;
}

/** Computes SHA-256 of a 153-byte DOT buffer (for chain linking). */
export function sha256Of(buf: Uint8Array): Uint8Array {
  return sha256(buf);
}

/**
 * Builds a chain of N v0.3.0 DOTs.
 *
 * Index 0 is the genesis (chainHash = 32 zeros).
 * Each subsequent DOT's chainHash = SHA-256 of previous raw buffer.
 */
export async function buildLegacyChain(
  kp: LegacyKeyPair,
  length: number,
  opts: {
    type?: number;
    payloadPrefix?: string;
  } = {},
): Promise<Uint8Array[]> {
  const chain: Uint8Array[] = [];

  for (let i = 0; i < length; i++) {
    const chainHash =
      i === 0 ? new Uint8Array(32) : sha256Of(chain[i - 1]!);
    const payload =
      opts.payloadPrefix !== undefined
        ? new TextEncoder().encode(`${opts.payloadPrefix}${i}`).slice(0, 16)
        : undefined;

    const dot = await buildLegacyDOT(kp, {
      chainHash,
      timestamp: 1700000000000 + i * 1000,
      type: opts.type ?? 0x00,
      payload,
    });
    chain.push(dot);
  }
  return chain;
}

/** Tampers with a byte in the DOT buffer (for negative tests). */
export function tamperByte(buf: Uint8Array, offset: number, value: number): Uint8Array {
  const copy = new Uint8Array(buf);
  copy[offset] = value;
  return copy;
}

/** Encodes a string to UTF-8 bytes, truncated to maxLen. */
export function textBytes(s: string, maxLen = 16): Uint8Array {
  return new TextEncoder().encode(s).slice(0, maxLen);
}
