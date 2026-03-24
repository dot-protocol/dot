/**
 * @module blake3
 * BLAKE3 hashing for the DOT Protocol.
 *
 * BLAKE3 is used for ALL hashing in R854 — observation IDs, chain links,
 * content addressing. It is faster than SHA-256 and provides 256-bit security.
 *
 * Uses the `blake3` npm package (native Node.js binding when available,
 * WASM fallback otherwise). Imported via createRequire because blake3
 * ships as CommonJS.
 */

import { createRequire } from 'module';
import { timed } from './metrics.js';

const require = createRequire(import.meta.url);

// blake3's main entry auto-selects the node build (native or WASM).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b3 = require('blake3') as {
  hash(input: Uint8Array | Buffer | string): Buffer;
  createHash(): {
    update(data: Uint8Array | Buffer | string): void;
    digest(encoding?: 'hex'): Buffer | string;
  };
};

/**
 * Compute a BLAKE3 hash of the input data.
 *
 * @param data - Raw bytes to hash
 * @returns 32-byte hash output
 */
export function hash(data: Uint8Array): Uint8Array {
  return timed('hash', () => {
    const buf = b3.hash(Buffer.from(data));
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });
}

/**
 * Compute a BLAKE3 hash and return it as a lowercase hex string.
 *
 * @param data - Raw bytes to hash
 * @returns 64-character lowercase hex string
 */
export function hashHex(data: Uint8Array): string {
  return timed('hash', () => {
    const buf = b3.hash(Buffer.from(data));
    return buf.toString('hex');
  });
}

/** Streaming hasher handle returned by hashStream(). */
export interface StreamHasher {
  /**
   * Feed a chunk of data into the running hash.
   *
   * @param chunk - Bytes to absorb
   */
  update(chunk: Uint8Array): void;

  /**
   * Finalise the hash and return the 32-byte digest.
   *
   * @returns 32-byte BLAKE3 digest
   */
  finalize(): Uint8Array;
}

/**
 * Create a streaming BLAKE3 hasher.
 *
 * Feed arbitrarily many chunks via update(), then call finalize() once
 * to obtain the digest. After finalize() the hasher must not be reused.
 *
 * @returns StreamHasher
 *
 * @example
 * ```ts
 * const h = hashStream();
 * h.update(chunk1);
 * h.update(chunk2);
 * const digest = h.finalize();
 * ```
 */
export function hashStream(): StreamHasher {
  const inner = b3.createHash();
  return {
    update(chunk: Uint8Array): void {
      inner.update(Buffer.from(chunk));
    },
    finalize(): Uint8Array {
      // streaming finalize is not a hash op metric — it's amortised
      const buf = inner.digest() as Buffer;
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
  };
}
