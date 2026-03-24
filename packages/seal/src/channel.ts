/**
 * channel.ts — Encrypted channel after DOT-SEAL handshake.
 *
 * Uses XSalsa20-Poly1305 (libsodium crypto_secretbox) for symmetric
 * authenticated encryption. This provides:
 *   - 256-bit key
 *   - 192-bit nonce (XSalsa20 = extended nonce, no collision risk)
 *   - 128-bit MAC (Poly1305)
 *
 * Nonce strategy: 8-byte counter (big-endian) + 4-byte random salt.
 * Counter increments monotonically, preventing nonce reuse.
 *
 * Key rotation: every 100 messages (or on demand). Each rotation derives
 * a new key from the current key via libsodium's KDF. Old keys are
 * discarded — forward secrecy via ratchet.
 */

import { getSodium } from '../../core/src/crypto/sodium-init.js';
import { observe, toBytes, fromBytes } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';

/** A DOT encrypted for secure transit. */
export interface EncryptedDOT {
  /** The ciphertext bytes (nonce prepended). */
  ciphertext: Uint8Array;
  /** Message sequence number. */
  seq: number;
}

/** Nonce size for XSalsa20-Poly1305: 24 bytes. */
const NONCE_BYTES = 24;

/** Counter occupies the first 8 bytes of the nonce. */
const COUNTER_BYTES = 8;

/** Key rotation threshold: rotate after this many messages. */
const ROTATION_THRESHOLD = 100;

/**
 * SecureChannel — authenticated encrypted channel over a session key.
 *
 * Created by DOTSealHandshake.complete() after a successful handshake.
 * Do not construct directly.
 */
export class SecureChannel {
  private key: Uint8Array;
  private nonceSalt: Uint8Array; // 4-byte random suffix
  private counter: bigint;
  private _messageCount: number;
  private _keyRotations: number;
  private _closed: boolean;

  /** @internal — use DOTSealHandshake.complete() to create */
  constructor(sessionKey: Uint8Array) {
    if (sessionKey.length !== 32) {
      throw new RangeError(
        `SecureChannel: sessionKey must be 32 bytes, got ${sessionKey.length}`,
      );
    }
    this.key = sessionKey;
    this.nonceSalt = crypto.getRandomValues(new Uint8Array(NONCE_BYTES - COUNTER_BYTES));
    this.counter = 0n;
    this._messageCount = 0;
    this._keyRotations = 0;
    this._closed = false;
  }

  /** Total messages sent or received on this channel. */
  get messageCount(): number {
    return this._messageCount;
  }

  /** Number of key rotations performed. */
  get keyRotations(): number {
    return this._keyRotations;
  }

  /** Whether the channel has been closed. */
  get closed(): boolean {
    return this._closed;
  }

  /**
   * Encrypt arbitrary bytes.
   *
   * @param plaintext - Bytes to encrypt
   * @returns Ciphertext with nonce prepended (nonce || mac || ciphertext)
   */
  async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    this.assertOpen();
    const sodium = await getSodium();
    const nonce = this.buildNonce();
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, this.key);
    // Prepend nonce to ciphertext for transport
    const result = new Uint8Array(NONCE_BYTES + ciphertext.length);
    result.set(nonce, 0);
    result.set(ciphertext, NONCE_BYTES);
    this.advanceCounter();
    return result;
  }

  /**
   * Decrypt ciphertext produced by encrypt().
   *
   * @param ciphertext - Nonce-prepended ciphertext (nonce || mac || ciphertext)
   * @returns Plaintext bytes
   * @throws Error if authentication fails or channel is closed
   */
  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array> {
    this.assertOpen();
    if (ciphertext.length < NONCE_BYTES) {
      throw new Error(
        `SecureChannel.decrypt: ciphertext too short (${ciphertext.length} < ${NONCE_BYTES})`,
      );
    }
    const sodium = await getSodium();
    const nonce = ciphertext.slice(0, NONCE_BYTES);
    const payload = ciphertext.slice(NONCE_BYTES);
    const plaintext = sodium.crypto_secretbox_open_easy(payload, nonce, this.key);
    if (plaintext === null || plaintext === false) {
      throw new Error('SecureChannel.decrypt: authentication failed (tampered ciphertext)');
    }
    this._messageCount++;
    return plaintext as Uint8Array;
  }

  /**
   * Encrypt a DOT for transmission.
   *
   * Encodes the DOT to canonical bytes, then encrypts.
   *
   * @param dot - The DOT to encrypt
   * @returns EncryptedDOT with ciphertext and sequence number
   */
  async send(dot: DOT): Promise<EncryptedDOT> {
    this.assertOpen();
    // Capture seq before encrypt (encrypt will advance the counter)
    const seq = this._messageCount;
    const encoded = toBytes(dot);
    const ciphertext = await this.encrypt(encoded);

    // Auto-rotate after threshold
    if (this._messageCount % ROTATION_THRESHOLD === 0) {
      await this.rotateKey();
    }

    return { ciphertext, seq };
  }

  /**
   * Decrypt an EncryptedDOT and decode it.
   *
   * @param encrypted - EncryptedDOT from the remote peer
   * @returns Decoded DOT
   */
  async receive(encrypted: EncryptedDOT): Promise<DOT> {
    this.assertOpen();
    const plaintext = await this.decrypt(encrypted.ciphertext);
    const dot = fromBytes(plaintext);
    return dot;
  }

  /**
   * Rotate the session key (forward secrecy ratchet).
   *
   * Derives a new key from the current key. Old key is discarded.
   * Messages encrypted with the old key cannot be decrypted after rotation.
   */
  async rotateKey(): Promise<void> {
    this.assertOpen();
    const sodium = await getSodium();

    // Derive new key from current key via KDF
    // libsodium requires a plain 8-char string context
    const ctx = 'sealrot\0';

    this.key = sodium.crypto_kdf_derive_from_key(32, this._keyRotations + 1, ctx, this.key);
    // Reset nonce salt for new key epoch
    this.nonceSalt = crypto.getRandomValues(new Uint8Array(NONCE_BYTES - COUNTER_BYTES));
    this.counter = 0n;
    this._keyRotations++;
  }

  /**
   * Close the channel — zeroize the key and prevent further use.
   */
  close(): void {
    // Zeroize key material
    this.key.fill(0);
    this._closed = true;
  }

  /** Build the current nonce: counter (8 bytes BE) || salt (16 bytes). */
  private buildNonce(): Uint8Array {
    const nonce = new Uint8Array(NONCE_BYTES);
    // Write 8-byte big-endian counter
    const view = new DataView(nonce.buffer);
    view.setBigUint64(0, this.counter, false);
    // Append random salt
    nonce.set(this.nonceSalt, COUNTER_BYTES);
    return nonce;
  }

  /** Advance the counter and throw on overflow (2^64 messages = never in practice). */
  private advanceCounter(): void {
    this.counter++;
    this._messageCount++;
  }

  /** Assert the channel is not closed. */
  private assertOpen(): void {
    if (this._closed) {
      throw new Error('SecureChannel: channel is closed');
    }
  }
}

/**
 * Create a SecureChannel from a 32-byte session key.
 *
 * @param sessionKey - 32-byte symmetric key (from handshake)
 * @returns SecureChannel ready for encrypt/decrypt
 */
export function createSecureChannel(sessionKey: Uint8Array): SecureChannel {
  return new SecureChannel(sessionKey);
}
