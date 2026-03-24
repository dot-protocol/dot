/**
 * @module ed25519
 * Ed25519 digital signatures for the DOT Protocol via libsodium.
 *
 * Every DOT observation is signed with Ed25519. Signatures are 64 bytes;
 * public keys are 32 bytes; secret keys (as returned by libsodium) are
 * 64 bytes (seed || public key — the standard "extended" representation).
 *
 * All functions are async because libsodium must be initialised before use.
 */

import { getSodium } from './sodium-init.js';
import { timed } from './metrics.js';

/** An Ed25519 keypair. */
export interface Keypair {
  /** 32-byte Ed25519 public key. */
  publicKey: Uint8Array;
  /**
   * 64-byte Ed25519 secret key.
   * Libsodium format: seed (32 bytes) concatenated with public key (32 bytes).
   */
  secretKey: Uint8Array;
}

/**
 * Generate a new random Ed25519 keypair.
 *
 * @returns Keypair with 32-byte publicKey and 64-byte secretKey
 *
 * @example
 * ```ts
 * const { publicKey, secretKey } = await generateKeypair();
 * ```
 */
export async function generateKeypair(): Promise<Keypair> {
  const sodium = await getSodium();
  const kp = sodium.crypto_sign_keypair();
  return {
    publicKey: kp.publicKey,
    secretKey: kp.privateKey,
  };
}

/**
 * Sign a message with an Ed25519 secret key.
 *
 * @param message   - Arbitrary bytes to sign (may be empty)
 * @param secretKey - 64-byte Ed25519 secret key from generateKeypair()
 * @returns 64-byte detached signature
 *
 * @example
 * ```ts
 * const sig = await sign(message, secretKey);
 * ```
 */
export async function sign(
  message: Uint8Array,
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  if (secretKey.length !== 64) {
    throw new RangeError(
      `sign: secretKey must be 64 bytes, got ${secretKey.length}`,
    );
  }
  const sodium = await getSodium();
  return timed('sign', () =>
    sodium.crypto_sign_detached(message, secretKey),
  );
}

/**
 * Verify an Ed25519 detached signature.
 *
 * @param message   - The original message bytes
 * @param signature - 64-byte detached signature to verify
 * @param publicKey - 32-byte Ed25519 public key of the signer
 * @returns true if the signature is valid, false otherwise
 *
 * @example
 * ```ts
 * const ok = await verify(message, signature, publicKey);
 * ```
 */
export async function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  if (signature.length !== 64) {
    throw new RangeError(
      `verify: signature must be 64 bytes, got ${signature.length}`,
    );
  }
  if (publicKey.length !== 32) {
    throw new RangeError(
      `verify: publicKey must be 32 bytes, got ${publicKey.length}`,
    );
  }
  const sodium = await getSodium();
  return timed('verify', () =>
    sodium.crypto_sign_verify_detached(signature, message, publicKey),
  );
}

/**
 * Derive the 32-byte public key from a 64-byte Ed25519 secret key.
 *
 * Libsodium stores the public key in the second 32 bytes of the secretKey
 * ("extended" key format). This function extracts it without any crypto.
 *
 * @param secretKey - 64-byte Ed25519 secret key
 * @returns 32-byte public key
 */
export async function publicKeyFromSecret(
  secretKey: Uint8Array,
): Promise<Uint8Array> {
  if (secretKey.length !== 64) {
    throw new RangeError(
      `publicKeyFromSecret: secretKey must be 64 bytes, got ${secretKey.length}`,
    );
  }
  const sodium = await getSodium();
  return sodium.crypto_sign_ed25519_sk_to_pk(secretKey);
}
