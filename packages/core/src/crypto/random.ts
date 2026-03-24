/**
 * @module random
 * Cryptographically secure random byte generation via libsodium.
 *
 * Uses libsodium's randombytes_buf() which sources entropy from the OS
 * (getrandom(2) on Linux, arc4random on macOS/BSD, BCryptGenRandom on Windows).
 */

import { getSodium } from './sodium-init.js';

/**
 * Generate n cryptographically secure random bytes.
 *
 * @param n - Number of bytes to generate (must be > 0)
 * @returns Uint8Array of n random bytes
 *
 * @example
 * ```ts
 * const nonce = randomBytes(24);
 * ```
 */
export async function randomBytes(n: number): Promise<Uint8Array> {
  if (n <= 0) throw new RangeError(`randomBytes: n must be > 0, got ${n}`);
  const sodium = await getSodium();
  return sodium.randombytes_buf(n);
}
