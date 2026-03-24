/**
 * hash.ts — BLAKE3 hash wrapper for DOT Protocol.
 *
 * Provides a stable async interface over the blake3 node module.
 * This is an internal module — not exported from index.ts.
 */

import { hash as blake3hash } from 'blake3';

/**
 * Computes a 32-byte BLAKE3 hash of the given input bytes.
 *
 * @param input - Bytes to hash
 * @returns 32-byte BLAKE3 digest as Uint8Array
 */
export async function createHash(input: Uint8Array): Promise<Uint8Array> {
  const result = blake3hash(input, { length: 32 });
  // blake3 returns Buffer (Node.js) — wrap in Uint8Array for portability
  return new Uint8Array(result as Buffer);
}

/**
 * Synchronously computes a 32-byte BLAKE3 hash of the given input bytes.
 *
 * @param input - Bytes to hash
 * @returns 32-byte BLAKE3 digest as Uint8Array
 */
export function createHashSync(input: Uint8Array): Uint8Array {
  const result = blake3hash(input, { length: 32 });
  return new Uint8Array(result as Buffer);
}
