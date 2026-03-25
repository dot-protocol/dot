/**
 * @dot-protocol/core — Cross-Language Test Vectors
 *
 * Verifies that:
 * 1. All existing test-vectors/core/crypto.json vectors are valid in TS
 * 2. All existing test-vectors/core/dot-roundtrip.json structural invariants hold
 * 3. New extended vectors are generated and written to test-vectors/core/extended-crypto.json
 *
 * The Rust implementation MUST reproduce identical outputs for all vectors.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as ed from '@noble/ed25519';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  observe,
  sign,
  verify,
  toBytes,
  fromBytes,
  computeTrust,
  createIdentity,
} from '../src/index.js';
import { createHash, createHashSync } from '../src/hash.js';
import type { DOT } from '../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Repo root is 3 levels up from packages/core/tests/
const REPO_ROOT = join(__dirname, '..', '..', '..');
const TEST_VECTORS_DIR = join(REPO_ROOT, 'test-vectors', 'core');
const CRYPTO_VECTORS_PATH = join(TEST_VECTORS_DIR, 'crypto.json');
const EXTENDED_VECTORS_PATH = join(TEST_VECTORS_DIR, 'extended-crypto.json');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  if (hex.length === 0) return new Uint8Array(0);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

interface CryptoVector {
  description: string;
  secret_key_hex: string;
  public_key_hex: string;
  message_hex: string;
  signature_hex: string;
  blake3_hash_hex: string;
}

interface CryptoVectorFile {
  version: string;
  description: string;
  vectors: CryptoVector[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Verify existing crypto.json vectors (10+ tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Language: Existing crypto.json vectors', () => {
  let cryptoFile: CryptoVectorFile;

  beforeAll(() => {
    const raw = readFileSync(CRYPTO_VECTORS_PATH, 'utf-8');
    cryptoFile = JSON.parse(raw) as CryptoVectorFile;
  });

  it('crypto.json file loads and has vectors', () => {
    expect(cryptoFile).toBeDefined();
    expect(cryptoFile.vectors).toBeDefined();
    expect(Array.isArray(cryptoFile.vectors)).toBe(true);
    expect(cryptoFile.vectors.length).toBeGreaterThan(0);
  });

  it('all vectors: public key derived from secret key matches expected', async () => {
    for (const vec of cryptoFile.vectors) {
      const secretKey = hexToBytes(vec.secret_key_hex);
      const expectedPubKey = hexToBytes(vec.public_key_hex);
      // @noble/ed25519 derives public key from 32-byte seed
      // The secret_key_hex is 64 bytes (seed + pubkey in libsodium format)
      const seed = secretKey.slice(0, 32);
      const derivedPubKey = await ed.getPublicKeyAsync(seed);
      expect(bytesEqual(derivedPubKey, expectedPubKey)).toBe(true);
    }
  });

  it('all vectors: Ed25519 signature verifies against message and public key', async () => {
    for (const vec of cryptoFile.vectors) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const publicKey = hexToBytes(vec.public_key_hex);
      const message = hexToBytes(vec.message_hex);
      const signature = hexToBytes(vec.signature_hex);

      const valid = await ed.verifyAsync(signature, message, publicKey);
      expect(valid).toBe(true);
    }
  });

  it('all vectors: BLAKE3 hash of message matches expected hash', async () => {
    for (const vec of cryptoFile.vectors) {
      const message = hexToBytes(vec.message_hex);
      const expectedHash = hexToBytes(vec.blake3_hash_hex);
      const computed = await createHash(message);
      expect(bytesEqual(computed, expectedHash)).toBe(true);
    }
  });

  it('all vectors: BLAKE3 hash is exactly 32 bytes', async () => {
    for (const vec of cryptoFile.vectors) {
      const message = hexToBytes(vec.message_hex);
      const computed = await createHash(message);
      expect(computed.length).toBe(32);
    }
  });

  it('all vectors: Ed25519 signature is exactly 64 bytes', () => {
    for (const vec of cryptoFile.vectors) {
      const sig = hexToBytes(vec.signature_hex);
      expect(sig.length).toBe(64);
    }
  });

  it('all vectors: public key is exactly 32 bytes', () => {
    for (const vec of cryptoFile.vectors) {
      const pubKey = hexToBytes(vec.public_key_hex);
      expect(pubKey.length).toBe(32);
    }
  });

  it('all vectors: signing is deterministic (re-sign matches stored signature)', async () => {
    for (const vec of cryptoFile.vectors) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const message = hexToBytes(vec.message_hex);
      const expectedSig = hexToBytes(vec.signature_hex);
      const computed = await ed.signAsync(message, seed);
      expect(bytesEqual(computed, expectedSig)).toBe(true);
    }
  });

  it('empty message vector: BLAKE3 matches known empty-input hash', async () => {
    // blake3("") = af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262
    const emptyVec = cryptoFile.vectors.find((v) => v.description === 'empty message');
    expect(emptyVec).toBeDefined();
    if (emptyVec) {
      const h = await createHash(new Uint8Array(0));
      expect(bytesToHex(h)).toBe(emptyVec.blake3_hash_hex);
    }
  });

  it('abc vector: BLAKE3 matches spec (6437b3ac...)', async () => {
    const abcVec = cryptoFile.vectors.find((v) => v.description === 'blake3 known: abc');
    expect(abcVec).toBeDefined();
    if (abcVec) {
      const h = await createHash(hexToBytes(abcVec.message_hex));
      expect(bytesToHex(h)).toBe(abcVec.blake3_hash_hex);
    }
  });

  it('64-zero-bytes vector: matches expected hash and signature', async () => {
    const vec = cryptoFile.vectors.find((v) => v.description === '64 zero bytes');
    expect(vec).toBeDefined();
    if (vec) {
      const msg = hexToBytes(vec.message_hex);
      expect(msg.length).toBe(64);
      expect(msg.every((b) => b === 0)).toBe(true);

      const h = await createHash(msg);
      expect(bytesToHex(h)).toBe(vec.blake3_hash_hex);

      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const sig = await ed.signAsync(msg, seed);
      expect(bytesToHex(sig)).toBe(vec.signature_hex);
    }
  });

  it('all vectors: wrong-key verification returns false', async () => {
    for (const vec of cryptoFile.vectors) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const message = hexToBytes(vec.message_hex);
      const signature = hexToBytes(vec.signature_hex);

      // Use a different key (flip first byte of public key)
      const wrongKey = await ed.getPublicKeyAsync(seed);
      wrongKey[0] = wrongKey[0]! ^ 0x01;

      try {
        const valid = await ed.verifyAsync(signature, message, wrongKey);
        // May return false or throw — both are acceptable
        expect(valid).toBe(false);
      } catch {
        // Acceptable — bad key caused an error
      }
    }
  });

  it('all vectors: tampered message does not verify', async () => {
    for (const vec of cryptoFile.vectors) {
      if (vec.message_hex.length === 0) continue; // skip empty message

      const publicKey = hexToBytes(vec.public_key_hex);
      const signature = hexToBytes(vec.signature_hex);
      const message = hexToBytes(vec.message_hex);

      // Flip first bit of first byte
      const tampered = new Uint8Array(message);
      tampered[0] = tampered[0]! ^ 0x01;

      const valid = await ed.verifyAsync(signature, tampered, publicKey);
      expect(valid).toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Verify dot-roundtrip.json structural invariants (5+ tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Language: dot-roundtrip.json invariants', () => {
  it('empty DOT encodes to exactly 0 bytes (TV-R854-001)', () => {
    const empty: DOT = {};
    const encoded = toBytes(empty);
    expect(encoded.length).toBe(0);
    expect(bytesToHex(encoded)).toBe('');
  });

  it('fromBytes(0 bytes) returns empty DOT (roundtrip of TV-R854-001)', () => {
    const decoded = fromBytes(new Uint8Array(0));
    expect(Object.keys(decoded).length).toBe(0);
  });

  it('payload_mode=none encodes to specific TLV (TV-R854-002 structural check)', () => {
    // tag=0x02, len=0x00000001, value=0x02 (none=index 2)
    const dot: DOT = { payload_mode: 'none' };
    const encoded = toBytes(dot);
    expect(encoded.length).toBe(6); // tag(1) + len(4) + value(1)
    expect(encoded[0]).toBe(0x02); // TAG_PAYLOAD_MODE
    expect(encoded[4]).toBe(0x01); // length = 1
    expect(encoded[5]).toBe(0x02); // none = index 2
  });

  it('from_bytes(to_bytes(dot)) produces equal DOT for any input (fundamental invariant)', () => {
    const testDots: DOT[] = [
      {},
      { payload_mode: 'none' },
      { type: 'measure' },
      { type: 'event' },
      { type: 'bond' },
      { payload: new TextEncoder().encode('hello'), payload_mode: 'plain' },
      { time: { utc: 1_742_827_200_000 } },
      { time: { utc: 1_742_827_200_000, monotonic: 42 } },
      { chain: { previous: new Uint8Array(32), depth: 0 } },
      { chain: { previous: new Uint8Array(32), depth: 1 } },
      { verify: { hash: new Uint8Array(32).fill(0xab) } },
      { fhe: { scheme: 'tfhe' } },
      { sign: { level: 'real' } },
      { sign: { level: 'pseudonymous' } },
    ];

    for (const dot of testDots) {
      const decoded = fromBytes(toBytes(dot));
      const reEncoded = toBytes(decoded);
      const original = toBytes(dot);
      expect(bytesEqual(original, reEncoded)).toBe(true);
    }
  });

  it('all multi-byte integers are big-endian (time.utc verification)', () => {
    // time.utc = 1_742_827_200_000 = 0x000001953C2A2400
    const utc = 1_742_827_200_000;
    const dot: DOT = { time: { utc } };
    const encoded = toBytes(dot);
    // tag=0x20, len=0x00000008, value=8 bytes
    expect(encoded[0]).toBe(0x20); // TAG_TIME_UTC
    expect(encoded[4]).toBe(0x08); // length = 8
    // big-endian: 0x000001953C2A2400
    expect(encoded[5]).toBe(0x00);
    expect(encoded[6]).toBe(0x00);
    expect(encoded[7]).toBe(0x01);
    expect(encoded[8]).toBe(0x95);
    // Decode back
    const decoded = fromBytes(encoded);
    expect(decoded.time?.utc).toBe(utc);
  });

  it('unknown tags are skipped, known tags produce expected output', () => {
    // Inject an unknown tag (0x60) into valid encoding
    const validDot: DOT = { type: 'claim' };
    const validEncoded = toBytes(validDot);
    // Prepend unknown tag TLV
    const unknownTlv = new Uint8Array([0x60, 0x00, 0x00, 0x00, 0x03, 0xAA, 0xBB, 0xCC]);
    const combined = new Uint8Array(unknownTlv.length + validEncoded.length);
    combined.set(unknownTlv);
    combined.set(validEncoded, unknownTlv.length);

    const decoded = fromBytes(combined);
    expect(decoded.type).toBe('claim');
    expect((decoded as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('chain.depth as 8-byte big-endian integer survives roundtrip', () => {
    const testDepths = [0, 1, 255, 256, 65535, 65536, 1_000_000];
    for (const depth of testDepths) {
      const dot: DOT = { chain: { previous: new Uint8Array(32), depth } };
      const decoded = fromBytes(toBytes(dot));
      expect(decoded.chain?.depth).toBe(depth);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Generate 50 NEW vectors → write extended-crypto.json
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Language: Generate extended-crypto.json (50 new vectors)', () => {
  interface ExtendedVector {
    id: string;
    description: string;
    secret_key_hex: string;
    public_key_hex: string;
    message_hex: string;
    signature_hex: string;
    blake3_hash_hex: string;
    message_length: number;
    edge_case?: string;
  }

  let vectors: ExtendedVector[];

  beforeAll(async () => {
    const generated: ExtendedVector[] = [];

    // Helper to add a vector
    async function addVector(id: string, description: string, message: Uint8Array, edgeCase?: string): Promise<void> {
      const identity = await createIdentity();
      const seed = identity.secretKey;
      const publicKey = identity.publicKey;
      const signature = await ed.signAsync(message, seed);
      const blake3Hash = await createHash(message);

      // Store in libsodium concatenated format (seed + pubkey = 64 bytes)
      const secretKeyFull = new Uint8Array(64);
      secretKeyFull.set(seed);
      secretKeyFull.set(publicKey, 32);

      generated.push({
        id,
        description,
        secret_key_hex: bytesToHex(secretKeyFull),
        public_key_hex: bytesToHex(publicKey),
        message_hex: bytesToHex(message),
        signature_hex: bytesToHex(signature),
        blake3_hash_hex: bytesToHex(blake3Hash),
        message_length: message.length,
        ...(edgeCase ? { edge_case: edgeCase } : {}),
      });
    }

    // Edge cases
    await addVector('EXT-001', 'empty payload', new Uint8Array(0), 'empty');
    await addVector('EXT-002', '1 byte: 0x00', new Uint8Array([0x00]), 'single-byte-zero');
    await addVector('EXT-003', '1 byte: 0x01', new Uint8Array([0x01]), 'single-byte-one');
    await addVector('EXT-004', '1 byte: 0xff', new Uint8Array([0xff]), 'single-byte-max');
    await addVector('EXT-005', '2 bytes: 0x0000', new Uint8Array([0x00, 0x00]), 'two-byte-zeros');
    await addVector('EXT-006', '2 bytes: 0xffff', new Uint8Array([0xff, 0xff]), 'two-byte-max');
    await addVector('EXT-007', '4 bytes all zeros', new Uint8Array(4).fill(0), 'four-byte-zeros');
    await addVector('EXT-008', '32 bytes all zeros', new Uint8Array(32).fill(0), 'thirty-two-byte-zeros');
    await addVector('EXT-009', '32 bytes all 0xff', new Uint8Array(32).fill(0xff), 'thirty-two-byte-max');
    await addVector('EXT-010', '64 bytes all zeros', new Uint8Array(64).fill(0), 'sixty-four-byte-zeros');
    await addVector('EXT-011', '64 bytes all 0xff', new Uint8Array(64).fill(0xff), 'sixty-four-byte-max');

    // ASCII string payloads
    const strings = [
      'a',
      'ab',
      'abc',
      'DOT',
      'R854',
      'hello',
      'hello world',
      'The quick brown fox jumps over the lazy dog',
      'DOT Protocol R854 — The contact itself.',
      'observe sign verify chain hash encode trust identity',
    ];
    for (let i = 0; i < strings.length; i++) {
      const msg = new TextEncoder().encode(strings[i]);
      await addVector(
        `EXT-${(12 + i).toString().padStart(3, '0')}`,
        `ASCII: "${strings[i]!.slice(0, 30)}"`,
        msg,
        'ascii-string'
      );
    }

    // 1KB payload
    const oneKB = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) oneKB[i] = i & 0xff;
    await addVector('EXT-022', '1KB sequential bytes', oneKB, '1kb');

    // Repeating patterns
    await addVector('EXT-023', '100 bytes: 0xdeadbeef pattern', new Uint8Array(100).map((_, i) => {
      const pattern = [0xde, 0xad, 0xbe, 0xef];
      return pattern[i % 4]!;
    }), 'pattern-deadbeef');

    await addVector('EXT-024', '100 bytes: incrementing', new Uint8Array(100).map((_, i) => i), 'incrementing');
    await addVector('EXT-025', '100 bytes: decrementing', new Uint8Array(100).map((_, i) => 99 - i), 'decrementing');

    // Random payloads of various sizes
    const randomSizes = [3, 7, 15, 31, 63, 127, 255, 500, 999];
    for (let i = 0; i < randomSizes.length; i++) {
      const size = randomSizes[i]!;
      // Use deterministic "random" bytes based on index for reproducibility
      const bytes = new Uint8Array(size).map((_, j) => (j * 37 + i * 13) & 0xff);
      await addVector(
        `EXT-${(26 + i).toString().padStart(3, '0')}`,
        `${size} bytes deterministic pseudo-random`,
        bytes,
        `size-${size}`
      );
    }

    // DOT-specific payloads (JSON)
    const jsonPayloads = [
      JSON.stringify({ type: 'observe', value: 42 }),
      JSON.stringify({ temperature: 98.6, unit: 'F', sensor: 'reactor-3' }),
      JSON.stringify({ event: 'DOT_CREATED', timestamp: 1_742_827_200_000 }),
      JSON.stringify({ chain_depth: 100, hash: '0'.repeat(64) }),
      JSON.stringify({ r854: true, correction: 47, empty_dot_valid: true }),
    ];
    for (let i = 0; i < jsonPayloads.length; i++) {
      const msg = new TextEncoder().encode(jsonPayloads[i]);
      await addVector(
        `EXT-${(35 + i).toString().padStart(3, '0')}`,
        `JSON payload ${i + 1}`,
        msg,
        'json-payload'
      );
    }

    // Already have 39 vectors; add 11 more to reach 50
    // Various byte lengths hitting TLV boundaries
    const boundarySizes = [1, 4, 5, 8, 9, 16, 17, 32, 33, 64, 65];
    for (let i = 0; i < boundarySizes.length; i++) {
      const size = boundarySizes[i]!;
      const bytes = new Uint8Array(size).fill(size & 0xff);
      await addVector(
        `EXT-${(40 + i).toString().padStart(3, '0')}`,
        `TLV boundary: ${size} bytes of value 0x${(size & 0xff).toString(16).padStart(2, '0')}`,
        bytes,
        `tlv-boundary-${size}`
      );
    }

    vectors = generated;
  });

  it('generated exactly 50 new vectors', () => {
    expect(vectors.length).toBe(50);
  });

  it('all generated vectors: signature verifies', async () => {
    for (const vec of vectors) {
      const publicKey = hexToBytes(vec.public_key_hex);
      const message = hexToBytes(vec.message_hex);
      const signature = hexToBytes(vec.signature_hex);
      const valid = await ed.verifyAsync(signature, message, publicKey);
      expect(valid).toBe(true);
    }
  });

  it('all generated vectors: BLAKE3 hash recomputes correctly', async () => {
    for (const vec of vectors) {
      const message = hexToBytes(vec.message_hex);
      const computed = await createHash(message);
      expect(bytesToHex(computed)).toBe(vec.blake3_hash_hex);
    }
  });

  it('all generated vectors: signature is exactly 64 bytes', () => {
    for (const vec of vectors) {
      expect(hexToBytes(vec.signature_hex).length).toBe(64);
    }
  });

  it('all generated vectors: public key is exactly 32 bytes', () => {
    for (const vec of vectors) {
      expect(hexToBytes(vec.public_key_hex).length).toBe(32);
    }
  });

  it('all generated vectors: message_length field matches actual message', () => {
    for (const vec of vectors) {
      expect(hexToBytes(vec.message_hex).length).toBe(vec.message_length);
    }
  });

  it('all generated vectors: signing is deterministic (re-sign matches)', async () => {
    for (const vec of vectors) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const message = hexToBytes(vec.message_hex);
      const expectedSig = hexToBytes(vec.signature_hex);
      const recomputed = await ed.signAsync(message, seed);
      expect(bytesEqual(recomputed, expectedSig)).toBe(true);
    }
  });

  it('edge case: empty message (EXT-001) has known BLAKE3 hash', async () => {
    const emptyVec = vectors.find((v) => v.id === 'EXT-001');
    expect(emptyVec).toBeDefined();
    if (emptyVec) {
      // BLAKE3 of empty = af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262
      expect(emptyVec.blake3_hash_hex).toBe('af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262');
    }
  });

  it('all generated vectors can be used in sign→verify pipeline via DOT core', async () => {
    // Sample 10 vectors and verify via the DOT core API
    const sample = vectors.slice(0, 10);
    for (const vec of sample) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const message = hexToBytes(vec.message_hex);
      const unsigned = observe(message.length > 0 ? message : undefined, { plaintext: true });
      const signed = await sign(unsigned, seed);
      const result = await verify(signed);
      expect(result.valid).toBe(true);
    }
  });

  it('writes extended-crypto.json to test-vectors/core/', () => {
    const output = {
      version: 'r854-extended',
      description: 'Extended cross-language test vectors generated by TypeScript. 50 vectors covering edge cases: empty input, single bytes, ASCII strings, JSON payloads, TLV boundaries, random sizes. The Rust implementation must produce identical sign/verify and blake3_hash_hex outputs.',
      generated_at: new Date().toISOString(),
      algorithms: {
        signing: 'Ed25519 (@noble/ed25519)',
        hashing: 'BLAKE3 (32-byte output, blake3 npm package)',
      },
      usage: 'For each vector: verify Ed25519 signature (message, signature, public_key) and recompute BLAKE3(message). Both must match.',
      vectors,
    };

    mkdirSync(TEST_VECTORS_DIR, { recursive: true });
    writeFileSync(EXTENDED_VECTORS_PATH, JSON.stringify(output, null, 2), 'utf-8');
    expect(true).toBe(true); // file written without error
  });

  it('written extended-crypto.json is readable and valid JSON', () => {
    const raw = readFileSync(EXTENDED_VECTORS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { vectors: ExtendedVector[] };
    expect(parsed.vectors.length).toBe(50);
  });

  it('extended vectors: all IDs are unique', () => {
    const ids = vectors.map((v) => v.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Blake3 sync vs async consistency
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Language: BLAKE3 sync/async consistency', () => {
  it('createHash (async) and createHashSync produce identical output', async () => {
    const testInputs = [
      new Uint8Array(0),
      new Uint8Array([0x00]),
      new Uint8Array([0xff]),
      new TextEncoder().encode('hello world'),
      new Uint8Array(32).fill(0xab),
      new Uint8Array(100).map((_, i) => i),
    ];

    for (const input of testInputs) {
      const asyncResult = await createHash(input);
      const syncResult = createHashSync(input);
      expect(bytesEqual(asyncResult, syncResult)).toBe(true);
    }
  });

  it('BLAKE3 is deterministic across 100 identical inputs', async () => {
    const input = new TextEncoder().encode('determinism test');
    const hashes = await Promise.all(
      Array.from({ length: 100 }, () => createHash(input))
    );
    const first = hashes[0]!;
    for (const h of hashes) {
      expect(bytesEqual(h, first)).toBe(true);
    }
  });

  it('BLAKE3 output has correct length for all inputs', async () => {
    const sizes = [0, 1, 2, 16, 32, 64, 128, 256, 1024];
    for (const size of sizes) {
      const input = new Uint8Array(size);
      const h = await createHash(input);
      expect(h.length).toBe(32);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: DOT integration with crypto vectors
// ─────────────────────────────────────────────────────────────────────────────

describe('Cross-Language: DOT integration', () => {
  it('DOT signed with vector keys verifies correctly', async () => {
    const raw = readFileSync(CRYPTO_VECTORS_PATH, 'utf-8');
    const cryptoFile = JSON.parse(raw) as CryptoVectorFile;

    for (const vec of cryptoFile.vectors.slice(0, 5)) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const unsigned = observe(
        hexToBytes(vec.message_hex).length > 0
          ? hexToBytes(vec.message_hex)
          : undefined,
        { plaintext: true }
      );
      const signed = await sign(unsigned, seed);
      const result = await verify(signed);
      expect(result.valid).toBe(true);
      // Verify the key matches
      expect(bytesToHex(signed.sign!.observer!)).toBe(vec.public_key_hex);
    }
  });

  it('DOTs created from vector keys have non-zero trust', async () => {
    const raw = readFileSync(CRYPTO_VECTORS_PATH, 'utf-8');
    const cryptoFile = JSON.parse(raw) as CryptoVectorFile;

    for (const vec of cryptoFile.vectors.slice(0, 3)) {
      const seed = hexToBytes(vec.secret_key_hex).slice(0, 32);
      const unsigned = observe('trust test', { plaintext: true });
      const signed = await sign(unsigned, seed);
      const trust = computeTrust(signed);
      expect(trust).toBeGreaterThan(0);
    }
  });

  it('DOTs roundtrip through TLV encoding with vector-signed content', async () => {
    const id = await createIdentity();
    const unsigned = observe('cross-lang roundtrip', { type: 'claim', plaintext: true });
    const signed = await sign(unsigned, id.secretKey);
    const encoded = toBytes(signed);
    const decoded = fromBytes(encoded);
    const result = await verify(decoded);
    expect(result.valid).toBe(true);
  });
});
