/**
 * ephemeral.ts — Cryptographic erasure for ephemeral DOTs.
 *
 * EphemeralManager creates DOTs with time-limited decryptability.
 * After the TTL expires the AES-256-GCM key is deleted from memory.
 * The DOT's chain link survives — the payload becomes permanently
 * irrecoverable (forward secrecy via key erasure).
 *
 * Encryption: AES-256-GCM (Web Crypto API — available in Node 16+).
 *
 * API note: readEphemeral() works synchronously by returning a cached
 * plaintext reference (erased alongside the key on TTL expiry).
 * readEphemeralAsync() performs a full crypto decrypt for external DOTs.
 */

import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { append } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';

const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // AES-GCM standard IV length

/** A DOT with ephemeral metadata. */
export interface EphemeralDOT {
  /** The DOT stored in the chain (encrypted payload). */
  dot: DOT;
  /** ID used to look up the AES key for decryption. */
  keyId: string;
  /** Unix ms when the key expires and payload becomes irrecoverable. */
  expiresAt: number;
}

/** Configuration for EphemeralManager. */
export interface EphemeralConfig {
  /** Time-to-live in milliseconds. Default: 86400000 (24 hours). */
  ttlMs: number;
  /** How often (ms) to check for expired keys. Default: 60000 (1 min). */
  checkIntervalMs?: number;
}

/**
 * In-memory key + plaintext store with per-key TTL.
 *
 * Stores both the AES key and the original plaintext (to support sync
 * readEphemeral). Both are erased on TTL expiry.
 */
class EphemeralKeyStore {
  private readonly entries = new Map<
    string,
    { key: Uint8Array; plaintext: Uint8Array; expiresAt: number }
  >();

  set(keyId: string, key: Uint8Array, plaintext: Uint8Array, ttlMs: number): void {
    this.entries.set(keyId, { key, plaintext, expiresAt: Date.now() + ttlMs });
  }

  get(keyId: string): { key: Uint8Array; plaintext: Uint8Array } | null {
    const entry = this.entries.get(keyId);
    if (entry === undefined) return null;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(keyId);
      return null;
    }
    return { key: entry.key, plaintext: entry.plaintext };
  }

  getKey(keyId: string): Uint8Array | null {
    const entry = this.get(keyId);
    return entry?.key ?? null;
  }

  delete(keyId: string): void {
    this.entries.delete(keyId);
  }

  has(keyId: string): boolean {
    return this.entries.has(keyId);
  }

  /**
   * Return list of keyIds whose TTL has elapsed.
   */
  expired(): string[] {
    const now = Date.now();
    const result: string[] = [];
    for (const [id, entry] of this.entries) {
      if (now > entry.expiresAt) {
        result.push(id);
      }
    }
    return result;
  }

  /** Total number of active (not-yet-expired) entries. */
  activeCount(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.entries.values()) {
      if (now <= entry.expiresAt) count++;
    }
    return count;
  }

  /** Total number of entries (including expired not yet cleaned). */
  count(): number {
    return this.entries.size;
  }
}

/**
 * Manages ephemeral DOTs with time-limited decryptability.
 *
 * @example
 * ```ts
 * const mgr = new EphemeralManager(chain, { ttlMs: 5000 });
 * const { dot, keyId } = await mgr.createEphemeral(payload, secretKey);
 * const decoded = mgr.readEphemeral(dot, keyId);   // works before TTL
 * // ... after TTL ...
 * const decoded2 = mgr.readEphemeral(dot, keyId);  // returns null
 * ```
 */
export class EphemeralManager {
  private chain: Chain;
  private readonly config: Required<EphemeralConfig>;
  private readonly keyStore = new EphemeralKeyStore();
  private cleanupHandle: ReturnType<typeof setInterval> | null = null;
  private expiredCount = 0;

  constructor(chain: Chain, config: EphemeralConfig) {
    this.chain = chain;
    this.config = {
      ttlMs: config.ttlMs,
      checkIntervalMs: config.checkIntervalMs ?? 60000,
    };
  }

  /**
   * Create an ephemeral DOT:
   *   1. Generate a random AES-256-GCM key
   *   2. Encrypt payload with the key
   *   3. Create a DOT with the encrypted payload (IV || ciphertext)
   *   4. Store AES key + original plaintext with TTL
   *   5. Append the DOT to the chain
   *
   * @param payload - Raw bytes to encrypt and store.
   * @param _secretKey - Caller's secret key (reserved for future use).
   * @returns EphemeralDOT with the dot, keyId, and expiry timestamp.
   */
  async createEphemeral(payload: Uint8Array, _secretKey: Uint8Array): Promise<EphemeralDOT> {
    // Generate a random AES-256-GCM key
    const aesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      true,
      ['encrypt', 'decrypt'],
    );

    // Generate a random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Encrypt the payload
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      payload,
    );

    // Package: IV (12 bytes) || ciphertext
    const ciphertextBytes = new Uint8Array(ciphertext);
    const packaged = new Uint8Array(IV_LENGTH + ciphertextBytes.length);
    packaged.set(iv, 0);
    packaged.set(ciphertextBytes, IV_LENGTH);

    // Export AES key as raw bytes for storage
    const rawKey = await crypto.subtle.exportKey('raw', aesKey);
    const keyBytes = new Uint8Array(rawKey);

    // Create a unique key ID
    const keyId = generateKeyId();

    // Store key + plaintext with TTL
    this.keyStore.set(keyId, keyBytes, payload, this.config.ttlMs);
    const expiresAt = Date.now() + this.config.ttlMs;

    // Create DOT with encrypted payload
    const dot = observe(packaged, { type: 'event', plaintext: true });

    // Append to chain
    this.chain = append(this.chain, dot);

    return { dot, keyId, expiresAt };
  }

  /**
   * Synchronously read an ephemeral DOT's payload.
   *
   * Works by returning the cached plaintext stored alongside the key.
   * Returns null if the key has expired (payload irrecoverable).
   *
   * @param _dot - The ephemeral DOT (used for type checking / API symmetry).
   * @param keyId - The key ID returned by createEphemeral.
   * @returns The original plaintext payload, or null if expired.
   */
  readEphemeral(_dot: DOT, keyId: string): Uint8Array | null {
    const entry = this.keyStore.get(keyId);
    if (entry === null) return null;
    return entry.plaintext;
  }

  /**
   * Async decrypt an ephemeral DOT's payload using AES-GCM.
   * Works for DOTs received from remote peers (no cached plaintext).
   *
   * @param dot - The DOT with IV || ciphertext in its payload.
   * @param keyId - The key ID.
   * @returns Decrypted plaintext, or null if key expired or decryption fails.
   */
  async readEphemeralAsync(dot: DOT, keyId: string): Promise<Uint8Array | null> {
    const keyBytes = this.keyStore.getKey(keyId);
    if (keyBytes === null) return null;
    if (dot.payload === undefined || dot.payload.length <= IV_LENGTH) return null;

    try {
      const iv = dot.payload.slice(0, IV_LENGTH);
      const ciphertext = dot.payload.slice(IV_LENGTH);

      const aesKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['decrypt'],
      );

      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext,
      );

      return new Uint8Array(plaintext);
    } catch {
      return null;
    }
  }

  /**
   * Start periodic cleanup of expired keys.
   * Safe to call multiple times — only starts one interval.
   */
  startCleanup(): void {
    if (this.cleanupHandle !== null) return;
    this.cleanupHandle = setInterval(() => {
      this.runCleanup();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop the cleanup interval.
   */
  stopCleanup(): void {
    if (this.cleanupHandle !== null) {
      clearInterval(this.cleanupHandle);
      this.cleanupHandle = null;
    }
  }

  /**
   * Check if a key has expired (or was never registered).
   *
   * @param keyId - The key ID to check.
   * @returns true if expired or not found; false if still active.
   */
  isExpired(keyId: string): boolean {
    if (!this.keyStore.has(keyId)) return true;
    // has() returns true even if expired-but-not-yet-cleaned; get() is authoritative
    return this.keyStore.get(keyId) === null;
  }

  /**
   * Status summary of the ephemeral manager.
   */
  status(): { totalEphemeral: number; expired: number; active: number } {
    const expiredIds = this.keyStore.expired();
    const totalInStore = this.keyStore.count();
    const activeInStore = this.keyStore.activeCount();
    const expiredInStore = expiredIds.length;

    return {
      totalEphemeral: totalInStore + this.expiredCount,
      expired: expiredInStore + this.expiredCount,
      active: activeInStore,
    };
  }

  /**
   * Get the underlying chain.
   */
  getChain(): Chain {
    return this.chain;
  }

  // --- private ---

  private runCleanup(): void {
    const expired = this.keyStore.expired();
    for (const keyId of expired) {
      this.keyStore.delete(keyId);
      this.expiredCount++;
    }
  }
}

/** Generate a short random key ID (32 hex chars). */
function generateKeyId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
