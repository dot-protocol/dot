/**
 * Comprehensive tests for the DOT Protocol R854 crypto layer.
 *
 * Coverage:
 *   BLAKE3    — empty / 1-byte / 1KB / 1MB / known vector / streaming / hex
 *   Ed25519   — keypair generation / sign+verify / wrong key / tampered message
 *               tampered signature / empty message / large message /
 *               determinism / public key derivation
 *   Random    — correct length / non-zero output / uniqueness
 *   Metrics   — counters increment / avg_ms is positive / reset works
 *   Perf      — sign avg < 1ms, verify avg < 0.5ms, hash(1KB) avg < 0.5ms
 *   Vectors   — all 10 cross-language test vectors pass
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

import { hash, hashHex, hashStream } from './blake3.js';
import {
  generateKeypair,
  sign,
  verify,
  publicKeyFromSecret,
} from './ed25519.js';
import { randomBytes } from './random.js';
import { getCryptoMetrics, resetMetrics } from './metrics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function fromHex(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'hex'));
}

function randomFill(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  for (let i = 0; i < n; i++) buf[i] = i & 0xff;
  return buf;
}

// ---------------------------------------------------------------------------
// BLAKE3
// ---------------------------------------------------------------------------

describe('BLAKE3', () => {
  it('empty input produces 32-byte output', () => {
    const out = hash(new Uint8Array(0));
    expect(out.byteLength).toBe(32);
  });

  it('empty input known vector', () => {
    // blake3("") = af1349b9...
    const out = hashHex(new Uint8Array(0));
    expect(out).toBe('af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262');
  });

  it('single-byte input produces 32-byte output', () => {
    const out = hash(new Uint8Array([0x42]));
    expect(out.byteLength).toBe(32);
  });

  it('1 KB input produces 32-byte output', () => {
    const out = hash(new Uint8Array(1024));
    expect(out.byteLength).toBe(32);
  });

  it('1 MB input produces 32-byte output', () => {
    const out = hash(new Uint8Array(1024 * 1024));
    expect(out.byteLength).toBe(32);
  });

  it('known vector: "hello world"', () => {
    const msg = new TextEncoder().encode('hello world');
    expect(hashHex(msg)).toBe(
      'd74981efa70a0c880b8d8c1985d075dbcbf679b99a5f9914e5aaf96b831a9e24',
    );
  });

  it('known vector: "abc"', () => {
    const msg = new TextEncoder().encode('abc');
    expect(hashHex(msg)).toBe(
      '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85',
    );
  });

  it('hashHex returns 64-character lowercase hex string', () => {
    const out = hashHex(new Uint8Array(32));
    expect(out).toHaveLength(64);
    expect(out).toMatch(/^[0-9a-f]+$/);
  });

  it('hash() and hashHex() are consistent', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const a = hex(hash(data));
    const b = hashHex(data);
    expect(a).toBe(b);
  });

  it('different inputs produce different hashes', () => {
    const a = hashHex(new Uint8Array([0]));
    const b = hashHex(new Uint8Array([1]));
    expect(a).not.toBe(b);
  });

  it('deterministic: same input always produces same hash', () => {
    const data = new Uint8Array([10, 20, 30]);
    expect(hashHex(data)).toBe(hashHex(data));
  });

  it('returns Uint8Array (not Buffer)', () => {
    const out = hash(new Uint8Array(8));
    expect(out).toBeInstanceOf(Uint8Array);
  });

  // Streaming
  it('streaming single chunk matches direct hash', () => {
    const data = randomFill(256);
    const direct = hash(data);
    const h = hashStream();
    h.update(data);
    const streamed = h.finalize();
    expect(hex(streamed)).toBe(hex(direct));
  });

  it('streaming multiple chunks matches direct hash', () => {
    const full = randomFill(1024);
    const direct = hash(full);

    const h = hashStream();
    h.update(full.slice(0, 256));
    h.update(full.slice(256, 512));
    h.update(full.slice(512, 768));
    h.update(full.slice(768, 1024));
    const streamed = h.finalize();

    expect(hex(streamed)).toBe(hex(direct));
  });

  it('streaming empty input matches direct hash of empty', () => {
    const direct = hash(new Uint8Array(0));
    const h = hashStream();
    const streamed = h.finalize();
    expect(hex(streamed)).toBe(hex(direct));
  });

  it('streaming 1 MB in 4 KB chunks matches direct hash', () => {
    const mb = new Uint8Array(1024 * 1024);
    for (let i = 0; i < mb.length; i++) mb[i] = i & 0xff;
    const direct = hash(mb);

    const h = hashStream();
    const chunkSize = 4096;
    for (let off = 0; off < mb.length; off += chunkSize) {
      h.update(mb.slice(off, off + chunkSize));
    }
    expect(hex(h.finalize())).toBe(hex(direct));
  });

  it('finalize() returns 32 bytes', () => {
    const h = hashStream();
    h.update(new Uint8Array([1, 2, 3]));
    expect(h.finalize().byteLength).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// Ed25519
// ---------------------------------------------------------------------------

describe('Ed25519', () => {
  it('generateKeypair returns 32-byte publicKey', async () => {
    const { publicKey } = await generateKeypair();
    expect(publicKey.byteLength).toBe(32);
  });

  it('generateKeypair returns 64-byte secretKey', async () => {
    const { secretKey } = await generateKeypair();
    expect(secretKey.byteLength).toBe(64);
  });

  it('generateKeypair returns Uint8Array instances', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(secretKey).toBeInstanceOf(Uint8Array);
  });

  it('two generated keypairs differ', async () => {
    const a = await generateKeypair();
    const b = await generateKeypair();
    expect(hex(a.publicKey)).not.toBe(hex(b.publicKey));
    expect(hex(a.secretKey)).not.toBe(hex(b.secretKey));
  });

  it('sign returns 64-byte signature', async () => {
    const { secretKey } = await generateKeypair();
    const sig = await sign(new Uint8Array([1, 2, 3]), secretKey);
    expect(sig.byteLength).toBe(64);
  });

  it('sign returns Uint8Array', async () => {
    const { secretKey } = await generateKeypair();
    const sig = await sign(new Uint8Array([1]), secretKey);
    expect(sig).toBeInstanceOf(Uint8Array);
  });

  it('valid signature verifies', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new TextEncoder().encode('hello DOT');
    const sig = await sign(msg, secretKey);
    expect(await verify(msg, sig, publicKey)).toBe(true);
  });

  it('wrong public key fails verification', async () => {
    const { secretKey } = await generateKeypair();
    const { publicKey: wrongPK } = await generateKeypair();
    const msg = new TextEncoder().encode('hello DOT');
    const sig = await sign(msg, secretKey);
    expect(await verify(msg, sig, wrongPK)).toBe(false);
  });

  it('tampered message fails verification', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new Uint8Array([1, 2, 3, 4, 5]);
    const sig = await sign(msg, secretKey);
    const tampered = new Uint8Array(msg);
    tampered[0] ^= 0xff;
    expect(await verify(tampered, sig, publicKey)).toBe(false);
  });

  it('tampered signature fails verification', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new TextEncoder().encode('sensitive observation');
    const sig = await sign(msg, secretKey);
    const tampered = new Uint8Array(sig);
    tampered[0] ^= 0x01;
    expect(await verify(msg, tampered, publicKey)).toBe(false);
  });

  it('flipping last byte of signature fails', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new Uint8Array([42]);
    const sig = await sign(msg, secretKey);
    const tampered = new Uint8Array(sig);
    tampered[63] ^= 0x80;
    expect(await verify(msg, tampered, publicKey)).toBe(false);
  });

  it('empty message signs and verifies', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const sig = await sign(new Uint8Array(0), secretKey);
    expect(sig.byteLength).toBe(64);
    expect(await verify(new Uint8Array(0), sig, publicKey)).toBe(true);
  });

  it('large message (64 KB) signs and verifies', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = randomFill(65536);
    const sig = await sign(msg, secretKey);
    expect(await verify(msg, sig, publicKey)).toBe(true);
  });

  it('deterministic: same keypair + message yields identical signature', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new TextEncoder().encode('same every time');
    const sig1 = await sign(msg, secretKey);
    const sig2 = await sign(msg, secretKey);
    expect(hex(sig1)).toBe(hex(sig2));
    // and both verify
    expect(await verify(msg, sig1, publicKey)).toBe(true);
  });

  it('publicKeyFromSecret derives correct public key', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const derived = await publicKeyFromSecret(secretKey);
    expect(hex(derived)).toBe(hex(publicKey));
  });

  it('publicKeyFromSecret returns Uint8Array', async () => {
    const { secretKey } = await generateKeypair();
    const pk = await publicKeyFromSecret(secretKey);
    expect(pk).toBeInstanceOf(Uint8Array);
    expect(pk.byteLength).toBe(32);
  });

  it('sign throws on wrong-length secretKey', async () => {
    await expect(sign(new Uint8Array(1), new Uint8Array(32))).rejects.toThrow(
      /secretKey must be 64 bytes/,
    );
  });

  it('verify throws on wrong-length signature', async () => {
    const { publicKey } = await generateKeypair();
    await expect(
      verify(new Uint8Array(1), new Uint8Array(32), publicKey),
    ).rejects.toThrow(/signature must be 64 bytes/);
  });

  it('verify throws on wrong-length publicKey', async () => {
    const { secretKey } = await generateKeypair();
    const sig = await sign(new Uint8Array(1), secretKey);
    await expect(
      verify(new Uint8Array(1), sig, new Uint8Array(16)),
    ).rejects.toThrow(/publicKey must be 32 bytes/);
  });

  it('publicKeyFromSecret throws on wrong-length secretKey', async () => {
    await expect(publicKeyFromSecret(new Uint8Array(32))).rejects.toThrow(
      /secretKey must be 64 bytes/,
    );
  });
});

// ---------------------------------------------------------------------------
// Random
// ---------------------------------------------------------------------------

describe('randomBytes', () => {
  it('returns correct length (1 byte)', async () => {
    const r = await randomBytes(1);
    expect(r.byteLength).toBe(1);
  });

  it('returns correct length (32 bytes)', async () => {
    const r = await randomBytes(32);
    expect(r.byteLength).toBe(32);
  });

  it('returns correct length (64 bytes)', async () => {
    const r = await randomBytes(64);
    expect(r.byteLength).toBe(64);
  });

  it('returns correct length (256 bytes)', async () => {
    const r = await randomBytes(256);
    expect(r.byteLength).toBe(256);
  });

  it('returns Uint8Array', async () => {
    const r = await randomBytes(16);
    expect(r).toBeInstanceOf(Uint8Array);
  });

  it('output is not all zeros (statistical — p < 2^-248 to fail)', async () => {
    const r = await randomBytes(32);
    const allZero = r.every((b) => b === 0);
    expect(allZero).toBe(false);
  });

  it('two calls produce different values', async () => {
    const a = await randomBytes(32);
    const b = await randomBytes(32);
    expect(hex(a)).not.toBe(hex(b));
  });

  it('ten calls all differ from each other', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(hex(await randomBytes(16)));
    }
    expect(seen.size).toBe(10);
  });

  it('throws on n=0', async () => {
    await expect(randomBytes(0)).rejects.toThrow(/must be > 0/);
  });

  it('throws on negative n', async () => {
    await expect(randomBytes(-1)).rejects.toThrow(/must be > 0/);
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

describe('Metrics', () => {
  beforeEach(() => {
    resetMetrics();
  });

  it('initial state is all zeros', () => {
    const m = getCryptoMetrics();
    expect(m.sign.count).toBe(0);
    expect(m.verify.count).toBe(0);
    expect(m.hash.count).toBe(0);
  });

  it('hash() increments hash.count', () => {
    hash(new Uint8Array(8));
    hash(new Uint8Array(8));
    hash(new Uint8Array(8));
    expect(getCryptoMetrics().hash.count).toBe(3);
  });

  it('hashHex() increments hash.count', () => {
    hashHex(new Uint8Array(8));
    hashHex(new Uint8Array(8));
    expect(getCryptoMetrics().hash.count).toBe(2);
  });

  it('sign() increments sign.count', async () => {
    const { secretKey } = await generateKeypair();
    const msg = new Uint8Array([1]);
    await sign(msg, secretKey);
    await sign(msg, secretKey);
    expect(getCryptoMetrics().sign.count).toBe(2);
  });

  it('verify() increments verify.count', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new Uint8Array([1]);
    const sig = await sign(msg, secretKey);
    resetMetrics();
    await verify(msg, sig, publicKey);
    await verify(msg, sig, publicKey);
    expect(getCryptoMetrics().verify.count).toBe(2);
  });

  it('total_ms is positive after operations', async () => {
    const { secretKey } = await generateKeypair();
    await sign(new Uint8Array(32), secretKey);
    expect(getCryptoMetrics().sign.total_ms).toBeGreaterThan(0);
  });

  it('avg_ms is positive after operations', async () => {
    const { secretKey } = await generateKeypair();
    await sign(new Uint8Array(32), secretKey);
    expect(getCryptoMetrics().sign.avg_ms).toBeGreaterThan(0);
  });

  it('avg_ms = total_ms / count after multiple ops', async () => {
    const { secretKey } = await generateKeypair();
    const msg = new Uint8Array(32);
    await sign(msg, secretKey);
    await sign(msg, secretKey);
    await sign(msg, secretKey);
    const m = getCryptoMetrics().sign;
    expect(m.avg_ms).toBeCloseTo(m.total_ms / m.count, 10);
  });

  it('resetMetrics() zeroes all counters', async () => {
    hash(new Uint8Array(8));
    const { secretKey } = await generateKeypair();
    await sign(new Uint8Array(8), secretKey);
    resetMetrics();
    const m = getCryptoMetrics();
    expect(m.hash.count).toBe(0);
    expect(m.sign.count).toBe(0);
    expect(m.hash.total_ms).toBe(0);
    expect(m.sign.total_ms).toBe(0);
    expect(m.hash.avg_ms).toBe(0);
    expect(m.sign.avg_ms).toBe(0);
  });

  it('metrics are independent per operation type', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new Uint8Array(32);
    const sig = await sign(msg, secretKey);
    resetMetrics();
    hash(msg);
    hash(msg);
    await verify(msg, sig, publicKey);
    const m = getCryptoMetrics();
    expect(m.hash.count).toBe(2);
    expect(m.verify.count).toBe(1);
    expect(m.sign.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('Performance', () => {
  it('sign avg < 1 ms over 100 iterations', async () => {
    resetMetrics();
    const { secretKey } = await generateKeypair();
    const msg = new Uint8Array(64);
    for (let i = 0; i < 100; i++) {
      await sign(msg, secretKey);
    }
    const avg = getCryptoMetrics().sign.avg_ms;
    expect(avg).toBeLessThan(1);
  }, 10_000);

  it('verify avg < 0.5 ms over 100 iterations', async () => {
    const { publicKey, secretKey } = await generateKeypair();
    const msg = new Uint8Array(64);
    const sig = await sign(msg, secretKey);
    resetMetrics();
    for (let i = 0; i < 100; i++) {
      await verify(msg, sig, publicKey);
    }
    const avg = getCryptoMetrics().verify.avg_ms;
    expect(avg).toBeLessThan(0.5);
  }, 10_000);

  it('hash(1 KB) avg < 0.5 ms over 100 iterations', () => {
    resetMetrics();
    const data = new Uint8Array(1024);
    for (let i = 0; i < 100; i++) {
      hash(data);
    }
    const avg = getCryptoMetrics().hash.avg_ms;
    expect(avg).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// Cross-language test vectors
// ---------------------------------------------------------------------------

describe('Cross-language vectors', () => {
  // crypto.test.ts lives at packages/core/src/crypto/
  // Go up 4 dirs to reach the repo root, then into test-vectors/
  const vectorsPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../..',
    'test-vectors/core/crypto.json',
  );
  const { vectors } = JSON.parse(readFileSync(vectorsPath, 'utf-8')) as {
    vectors: Array<{
      description: string;
      secret_key_hex: string;
      public_key_hex: string;
      message_hex: string;
      signature_hex: string;
      blake3_hash_hex: string;
    }>;
  };

  for (const v of vectors) {
    it(`vector: ${v.description} — verify signature`, async () => {
      const message = fromHex(v.message_hex);
      const publicKey = fromHex(v.public_key_hex);
      const signature = fromHex(v.signature_hex);
      expect(await verify(message, signature, publicKey)).toBe(true);
    });

    it(`vector: ${v.description} — blake3 hash`, () => {
      const message = fromHex(v.message_hex);
      expect(hashHex(message)).toBe(v.blake3_hash_hex);
    });

    it(`vector: ${v.description} — sign produces same signature`, async () => {
      const message = fromHex(v.message_hex);
      const secretKey = fromHex(v.secret_key_hex);
      const sig = await sign(message, secretKey);
      expect(hex(sig)).toBe(v.signature_hex);
    });

    it(`vector: ${v.description} — public key derivation`, async () => {
      const secretKey = fromHex(v.secret_key_hex);
      const derived = await publicKeyFromSecret(secretKey);
      expect(hex(derived)).toBe(v.public_key_hex);
    });
  }
});
