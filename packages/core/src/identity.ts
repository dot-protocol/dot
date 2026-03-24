/**
 * identity.ts — Ed25519 keypair generation for DOT observers.
 *
 * An identity is an Ed25519 keypair. The public key is the observer identifier.
 * The secret key is used to sign DOTs.
 */

import * as ed from '@noble/ed25519';

/** An Ed25519 keypair for use as a DOT observer identity. */
export interface Identity {
  /** 32-byte Ed25519 public key — the observer identifier. */
  publicKey: Uint8Array;
  /** 32-byte Ed25519 secret key — kept private, used for signing. */
  secretKey: Uint8Array;
}

/**
 * Generates a new random Ed25519 keypair.
 *
 * Uses WebCrypto's CSPRNG for key generation.
 *
 * @returns Promise resolving to an Identity with publicKey and secretKey
 *
 * @example
 * const { publicKey, secretKey } = await createIdentity();
 * const unsigned = observe('hello');
 * const signed = await sign(unsigned, secretKey);
 */
export async function createIdentity(): Promise<Identity> {
  const secretKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(secretKey);
  return { publicKey, secretKey };
}
