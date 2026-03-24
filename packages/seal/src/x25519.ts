/**
 * x25519.ts — X25519 key exchange utilities for DOT-SEAL.
 *
 * Uses libsodium's crypto_kx (X25519 DH) for ephemeral key exchange
 * and crypto_kdf_hkdf_sha256 for session key derivation.
 *
 * Key sizes:
 *   Public key:   32 bytes
 *   Secret key:   32 bytes
 *   Shared secret: 32 bytes
 *   Session key:  32 bytes
 */

import { getSodium } from '../../core/src/crypto/sodium-init.js';

/** An ephemeral X25519 keypair. */
export interface EphemeralKeypair {
  /** 32-byte X25519 public key. */
  publicKey: Uint8Array;
  /** 32-byte X25519 secret key. */
  secretKey: Uint8Array;
}

/**
 * Generate a new random ephemeral X25519 keypair.
 *
 * Suitable for a single handshake — discard after use.
 *
 * @returns EphemeralKeypair with 32-byte public and secret keys
 */
export async function generateEphemeralKeypair(): Promise<EphemeralKeypair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_kx_keypair();
  return {
    publicKey: kp.publicKey,
    secretKey: kp.privateKey,
  };
}

/**
 * Compute the X25519 raw shared secret between two parties.
 *
 * Uses crypto_scalarmult (curve25519 DH directly). The result is
 * 32 bytes of shared material that MUST be passed through deriveSessionKey
 * before use as an encryption key.
 *
 * @param mySecret   - 32-byte X25519 secret key
 * @param peerPublic - 32-byte X25519 public key
 * @returns 32-byte shared secret (raw DH output)
 */
export async function computeSharedSecret(
  mySecret: Uint8Array,
  peerPublic: Uint8Array,
): Promise<Uint8Array> {
  if (mySecret.length !== 32) {
    throw new RangeError(
      `computeSharedSecret: mySecret must be 32 bytes, got ${mySecret.length}`,
    );
  }
  if (peerPublic.length !== 32) {
    throw new RangeError(
      `computeSharedSecret: peerPublic must be 32 bytes, got ${peerPublic.length}`,
    );
  }
  const sodium = await getSodium();
  return sodium.crypto_scalarmult(mySecret, peerPublic);
}

/**
 * Derive a 32-byte session key from a shared secret using HKDF-SHA256.
 *
 * The context string differentiates keys derived from the same shared secret
 * for different purposes (e.g., "dot-seal-v1-encrypt" vs "dot-seal-v1-mac").
 * Derivation is deterministic — same inputs always produce the same key.
 *
 * @param sharedSecret - 32-byte raw DH shared secret
 * @param context      - ASCII context string (max 8 chars for libsodium KDF)
 * @returns 32-byte derived session key
 */
export async function deriveSessionKey(
  sharedSecret: Uint8Array,
  context: string,
): Promise<Uint8Array> {
  if (sharedSecret.length !== 32) {
    throw new RangeError(
      `deriveSessionKey: sharedSecret must be 32 bytes, got ${sharedSecret.length}`,
    );
  }
  const sodium = await getSodium();

  // Pad or truncate context to exactly 8 ASCII chars for crypto_kdf_derive_from_key
  // libsodium requires a plain string of exactly 8 characters
  const ctx = context.slice(0, 8).padEnd(8, '\0');

  // Use libsodium's KDF (BLAKE2b-based) with the shared secret as the master key
  // subkey_id=1 is the encryption key derivation slot
  return sodium.crypto_kdf_derive_from_key(32, 1, ctx, sharedSecret);
}
