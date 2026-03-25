/**
 * inline-crypto.ts — Minimal browser crypto for the single-file HTML distribution.
 *
 * Generates the inline <script> block for browser-native cryptography.
 * Uses Web Crypto API (SubtleCrypto) — available in all modern browsers.
 *
 * IMPORTANT: This is a DEMO distribution. The crypto is real (Ed25519 via WebCrypto
 * on supported browsers, SHA-256 fallback hashing) but not the full DOT spec crypto.
 * Production would use WASM-compiled libsodium + BLAKE3.
 *
 * What it provides (in the generated script):
 * - Identity generation: Ed25519 keypair or random fallback
 * - SHA-256 hashing via SubtleCrypto (BLAKE3 fallback for demo)
 * - Keypair storage in localStorage
 * - hex encoding utilities
 */

/**
 * Returns the inline JavaScript crypto module as a string.
 * This string is embedded directly in the single-file HTML.
 */
export function inlineCryptoScript(): string {
  return `
// ── DOT Crypto Module (inline) ────────────────────────────────────────────
const DotCrypto = (function() {
  'use strict';

  // ── Hex utilities ──────────────────────────────────────────────────────

  function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }

  // ── Random bytes ───────────────────────────────────────────────────────

  function randomBytes(n) {
    const buf = new Uint8Array(n);
    crypto.getRandomValues(buf);
    return buf;
  }

  // ── SHA-256 hashing (SubtleCrypto) ─────────────────────────────────────

  async function sha256(data) {
    const buf = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return new Uint8Array(digest);
  }

  async function hashPayload(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await sha256(bytes);
    return bytesToHex(digest);
  }

  // ── Ed25519 identity ───────────────────────────────────────────────────
  // WebCrypto supports Ed25519 in Chrome 113+, Firefox 130+, Safari 17+
  // Fallback: random 32-byte "key" for demo purposes

  async function generateKeyPair() {
    try {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify']
      );
      const pubExported = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privExported = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      return {
        publicKey: bytesToHex(new Uint8Array(pubExported)),
        privateKeyPkcs8: Array.from(new Uint8Array(privExported)),
        _nativeKey: keyPair,
        method: 'webcrypto-ed25519'
      };
    } catch (_e) {
      // Fallback: random bytes (demo only — not real Ed25519)
      const sk = randomBytes(32);
      const pk = randomBytes(32);
      return {
        publicKey: bytesToHex(pk),
        privateKeyBytes: Array.from(sk),
        method: 'random-fallback'
      };
    }
  }

  async function signPayload(text, keyPair) {
    if (keyPair.method === 'webcrypto-ed25519' && keyPair._nativeKey) {
      try {
        const data = new TextEncoder().encode(text);
        const sig = await crypto.subtle.sign('Ed25519', keyPair._nativeKey.privateKey, data);
        return bytesToHex(new Uint8Array(sig));
      } catch (_e) {
        // fall through to hash-based demo sig
      }
    }
    // Demo fallback: SHA-256(text + publicKey)
    const combined = text + keyPair.publicKey;
    const digest = await sha256(new TextEncoder().encode(combined));
    return bytesToHex(digest);
  }

  // ── Keypair persistence ────────────────────────────────────────────────

  const IDENTITY_KEY = 'dot-identity-v1';

  async function loadOrCreateIdentity() {
    try {
      const stored = localStorage.getItem(IDENTITY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.publicKey) {
          // Restore native key if possible
          if (parsed.privateKeyPkcs8) {
            try {
              const privateKey = await crypto.subtle.importKey(
                'pkcs8',
                new Uint8Array(parsed.privateKeyPkcs8),
                { name: 'Ed25519' },
                true,
                ['sign']
              );
              const publicKey = await crypto.subtle.importKey(
                'raw',
                hexToBytes(parsed.publicKey),
                { name: 'Ed25519' },
                true,
                ['verify']
              );
              parsed._nativeKey = { privateKey, publicKey };
              parsed.method = 'webcrypto-ed25519';
              return parsed;
            } catch (_e) {
              // Fallback: use stored as random-fallback
              parsed.method = parsed.method || 'random-fallback';
              return parsed;
            }
          }
          return parsed;
        }
      }
    } catch (_e) {
      // ignore parse errors
    }

    const kp = await generateKeyPair();
    // Store without non-serializable native key
    const toStore = {
      publicKey: kp.publicKey,
      privateKeyPkcs8: kp.privateKeyPkcs8 ?? null,
      privateKeyBytes: kp.privateKeyBytes ?? null,
      method: kp.method
    };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(toStore));
    return kp;
  }

  // ── Short ID from public key ───────────────────────────────────────────

  function shortId(publicKeyHex) {
    return publicKeyHex.slice(0, 8) + '…' + publicKeyHex.slice(-4);
  }

  return {
    bytesToHex,
    hexToBytes,
    randomBytes,
    sha256,
    hashPayload,
    generateKeyPair,
    signPayload,
    loadOrCreateIdentity,
    shortId,
  };
})();
`.trim();
}
