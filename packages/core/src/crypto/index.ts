/**
 * @module crypto
 * DOT Protocol R854 cryptographic primitives.
 *
 * - BLAKE3  — fast 256-bit hashing for all content addressing
 * - Ed25519 — deterministic signatures via libsodium
 * - Random  — OS-sourced secure random bytes via libsodium
 * - Metrics — self-awareness: operation counts, durations, averages
 */

export { hash, hashHex, hashStream } from './blake3.js';
export type { StreamHasher } from './blake3.js';

export {
  generateKeypair,
  sign,
  verify,
  publicKeyFromSecret,
} from './ed25519.js';
export type { Keypair } from './ed25519.js';

export { randomBytes } from './random.js';

export { getCryptoMetrics, resetMetrics, recordOp } from './metrics.js';
export type { CryptoMetrics } from './metrics.js';
