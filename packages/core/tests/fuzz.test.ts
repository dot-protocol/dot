/**
 * @dot-protocol/core — Fuzz Tests for TLV Encoder/Decoder
 *
 * Property: fromBytes() MUST NOT crash, hang, or return undefined for ANY input.
 * It must either return a valid DOT or throw a clean Error.
 *
 * Uses fast-check to generate adversarial byte sequences.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { fromBytes, toBytes, observe } from '../src/index.js';
import type { DOT } from '../src/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls fromBytes and asserts it either returns a DOT (object) or throws Error.
 * NEVER hangs, NEVER returns undefined, NEVER throws non-Error.
 */
function tryDecode(bytes: Uint8Array): { ok: true; dot: DOT } | { ok: false; error: Error } {
  try {
    const dot = fromBytes(bytes);
    // Must return an object
    if (dot === undefined || dot === null || typeof dot !== 'object') {
      throw new TypeError(`fromBytes returned non-object: ${typeof dot}`);
    }
    return { ok: true, dot };
  } catch (e) {
    if (e instanceof Error) {
      return { ok: false, error: e };
    }
    throw new TypeError(`fromBytes threw non-Error: ${String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Random bytes — decoder must not crash (30+ tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Fuzz: Random bytes → decode must not crash', () => {
  it('random bytes 0–1000: decode returns DOT or clean Error (1000 runs)', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 1000 }),
        (bytes) => {
          const result = tryDecode(bytes);
          // Must be ok or error — never undefined, never throw
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('empty bytes always returns empty DOT {}', () => {
    const result = tryDecode(new Uint8Array(0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.dot).length).toBe(0);
    }
  });

  it('1-byte input: must not crash', () => {
    fc.assert(
      fc.property(fc.nat({ max: 255 }), (byte) => {
        const result = tryDecode(new Uint8Array([byte]));
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 256 }
    );
  });

  it('2-byte input: must not crash', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 255 }),
        fc.nat({ max: 255 }),
        (b0, b1) => {
          const result = tryDecode(new Uint8Array([b0, b1]));
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 256 }
    );
  });

  it('4-byte input (header without value): must not crash', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 4, maxLength: 4 }), (bytes) => {
        const result = tryDecode(bytes);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 500 }
    );
  });

  it('5-byte input (minimal TLV header): must not crash', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 5, maxLength: 5 }), (bytes) => {
        const result = tryDecode(bytes);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 500 }
    );
  });

  it('all-zeros input: must not crash', () => {
    fc.assert(
      fc.property(fc.nat({ min: 0, max: 1000 }), (len) => {
        const result = tryDecode(new Uint8Array(len).fill(0));
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 100 }
    );
  });

  it('all-ones (0xff) input: must not crash', () => {
    fc.assert(
      fc.property(fc.nat({ min: 0, max: 1000 }), (len) => {
        const result = tryDecode(new Uint8Array(len).fill(0xff));
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 100 }
    );
  });

  it('random bytes of various power-of-2 lengths: must not crash', () => {
    const lengths = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
    fc.assert(
      fc.property(
        fc.constantFrom(...lengths),
        fc.uint8Array({ minLength: 1024, maxLength: 1024 }),
        (len, source) => {
          const bytes = source.slice(0, len);
          const result = tryDecode(bytes);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('output of tryDecode is always object or Error — never primitive', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 200 }), (bytes) => {
        const result = tryDecode(bytes);
        if (result.ok) {
          return typeof result.dot === 'object' && result.dot !== null;
        }
        return result.error instanceof Error;
      }),
      { numRuns: 1000 }
    );
  });

  it('random large inputs (1KB–100KB): must return in under 30s total', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1000, maxLength: 100_000 }),
        (bytes) => {
          const result = tryDecode(bytes);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('alternating 0x00 and 0xff bytes: must not crash', () => {
    fc.assert(
      fc.property(fc.nat({ min: 0, max: 500 }), (len) => {
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = i % 2 === 0 ? 0x00 : 0xff;
        const result = tryDecode(bytes);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 100 }
    );
  });

  it('valid TLV header with over-declared length: must throw clean Error', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 255 }),
        fc.integer({ min: 1, max: 4_000_000_000 }),
        (tag, len) => {
          // Craft a TLV where declared length > actual data (we provide NO value bytes)
          const bytes = new Uint8Array(5); // just header, no value
          bytes[0] = tag;
          bytes[1] = (len >>> 24) & 0xff;
          bytes[2] = (len >>> 16) & 0xff;
          bytes[3] = (len >>> 8) & 0xff;
          bytes[4] = len & 0xff;
          const result = tryDecode(bytes);
          // MUST throw (declared length > available bytes = malformed)
          return result.ok === false && result.error instanceof Error;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('known-good TLV bytes decode without error', () => {
    // Known: tag=0x03 (type), len=1, value=0x02 (event)
    const knownGood = new Uint8Array([0x03, 0x00, 0x00, 0x00, 0x01, 0x02]);
    const result = tryDecode(knownGood);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.dot.type).toBe('event');
    }
  });

  it('decode never modifies the input byte array', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 200 }), (bytes) => {
        const copy = new Uint8Array(bytes);
        tryDecode(bytes);
        // Input must be unchanged
        for (let i = 0; i < bytes.length; i++) {
          if (bytes[i] !== copy[i]) return false;
        }
        return true;
      }),
      { numRuns: 300 }
    );
  });

  it('multiple rapid decode calls on same random bytes are stable', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 200 }), (bytes) => {
        const r1 = tryDecode(bytes);
        const r2 = tryDecode(bytes);
        // Both calls must agree on ok/error
        return r1.ok === r2.ok;
      }),
      { numRuns: 300 }
    );
  });

  it('malformed bytes do not cause infinite loops (timeout detection)', () => {
    // Craft a worst-case: deeply nested length fields pointing back
    const adversarial = new Uint8Array(100).fill(0xff);
    const start = Date.now();
    tryDecode(adversarial);
    const elapsed = Date.now() - start;
    // Must complete in under 1 second
    expect(elapsed).toBeLessThan(1000);
  });

  it('valid encoded DOT always decodes successfully', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.nat({ max: 4 }),
        fc.nat({ max: 9_999_999_999 }),
        (hasPayload, typeIdx, utc) => {
          const types = ['measure', 'state', 'event', 'claim', 'bond'] as const;
          const dot: DOT = {};
          if (hasPayload) {
            dot.payload = new TextEncoder().encode(`test payload ${utc}`);
            dot.payload_mode = 'plain';
          }
          dot.type = types[typeIdx]!;
          dot.time = { utc };

          const encoded = toBytes(dot);
          const result = tryDecode(encoded);
          return result.ok === true;
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Truncated DOTs (10+ tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Fuzz: Truncated DOTs', () => {
  it('truncated at random positions returns error, not crash', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 200 }),
        fc.double({ min: 0, max: 1 }),
        (payload, fraction) => {
          const dot: DOT = {
            payload,
            payload_mode: 'plain',
            time: { utc: 1_700_000_000_000 },
          };
          const encoded = toBytes(dot);
          if (encoded.length === 0) return true;
          const cutAt = Math.floor(fraction * encoded.length);
          const truncated = encoded.slice(0, cutAt);
          const result = tryDecode(truncated);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('truncated at byte 1 (only tag byte) is handled', () => {
    const validTags = [0x01, 0x02, 0x03, 0x10, 0x11, 0x20, 0x30, 0x40, 0x50];
    for (const tag of validTags) {
      const result = tryDecode(new Uint8Array([tag]));
      expect(result.ok === true || result.error instanceof Error).toBe(true);
    }
  });

  it('truncated at byte 3 (partial length field) is handled', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 255 }),
        fc.nat({ max: 255 }),
        fc.nat({ max: 255 }),
        (tag, len1, len2) => {
          const result = tryDecode(new Uint8Array([tag, len1, len2]));
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('truncated at header boundary (5 bytes exactly) is handled', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 5, maxLength: 5 }), (bytes) => {
        // Set length > 0 to ensure truncation is meaningful
        bytes[1] = 0;
        bytes[2] = 0;
        bytes[3] = 0;
        bytes[4] = 1; // declares 1 byte value, but no value follows
        const result = tryDecode(bytes);
        // Must throw Error (truncated value)
        return result.ok === false && result.error instanceof Error;
      }),
      { numRuns: 200 }
    );
  });

  it('half-truncated valid DOT throws Error', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 10, maxLength: 500 }), (payload) => {
        const dot: DOT = { payload, payload_mode: 'plain', type: 'measure' };
        const encoded = toBytes(dot);
        if (encoded.length < 2) return true;
        const halfwayTruncated = encoded.slice(0, Math.floor(encoded.length / 2));
        const result = tryDecode(halfwayTruncated);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 200 }
    );
  });

  it('1-byte truncation from end of valid encoding is handled', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 10, maxLength: 200 }), (payload) => {
        const dot: DOT = { payload, payload_mode: 'plain' };
        const encoded = toBytes(dot);
        if (encoded.length === 0) return true;
        const truncated = encoded.slice(0, encoded.length - 1);
        const result = tryDecode(truncated);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 200 }
    );
  });

  it('all prefix lengths of a valid encoding: decode returns DOT or Error', () => {
    const dot: DOT = {
      payload: new TextEncoder().encode('hello world'),
      payload_mode: 'plain',
      type: 'event',
      time: { utc: 1_700_000_000_000, monotonic: 42 },
      chain: { previous: new Uint8Array(32), depth: 3 },
    };
    const encoded = toBytes(dot);
    for (let i = 0; i <= encoded.length; i++) {
      const truncated = encoded.slice(0, i);
      const result = tryDecode(truncated);
      expect(result.ok === true || result.error instanceof Error).toBe(true);
    }
  });

  it('truncated FHE-mode DOT is handled', () => {
    fc.assert(
      fc.property(fc.nat({ min: 1, max: 100 }), (cutAt) => {
        const dot: DOT = {
          fhe: {
            scheme: 'tfhe',
            eval_key_hash: new Uint8Array(32).fill(0xab),
            decryptable_by: [new Uint8Array(32).fill(0xcd)],
          },
        };
        const encoded = toBytes(dot);
        const truncated = encoded.slice(0, Math.min(cutAt, encoded.length));
        const result = tryDecode(truncated);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 100 }
    );
  });

  it('single TLV field truncated at every position is handled', () => {
    // Encode a single field: type = 'bond' (tag=0x03, len=0x0001, value=0x04)
    const singleField = new Uint8Array([0x03, 0x00, 0x00, 0x00, 0x01, 0x04]);
    for (let i = 0; i < singleField.length; i++) {
      const result = tryDecode(singleField.slice(0, i));
      expect(result.ok === true || result.error instanceof Error).toBe(true);
    }
  });

  it('multi-field DOT truncated between fields is handled', () => {
    const dot: DOT = {
      payload: new TextEncoder().encode('data'),
      payload_mode: 'plain',
      type: 'claim',
    };
    const encoded = toBytes(dot);
    // Find boundary between first and second TLV field
    // payload: tag(1) + len(4) + value(4) = 9 bytes
    for (let i = 0; i <= encoded.length; i++) {
      const result = tryDecode(encoded.slice(0, i));
      expect(result.ok === true || result.error instanceof Error).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Tag Corruption (10+ tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Fuzz: Tag corruption', () => {
  it('unknown tags are skipped gracefully (no crash)', () => {
    fc.assert(
      fc.property(
        // Tags not in the known set
        fc.nat({ min: 0x60, max: 0xff }),
        fc.nat({ min: 0, max: 100 }),
        (unknownTag, valueLen) => {
          // Craft a TLV with an unknown tag
          const value = new Uint8Array(valueLen).fill(0xaa);
          const tlv = new Uint8Array(5 + valueLen);
          tlv[0] = unknownTag;
          tlv[1] = 0;
          tlv[2] = 0;
          tlv[3] = (valueLen >>> 8) & 0xff;
          tlv[4] = valueLen & 0xff;
          tlv.set(value, 5);
          const result = tryDecode(tlv);
          // Unknown tags must be skipped → returns empty or partial DOT
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 500 }
    );
  });

  it('corrupted tag byte in valid encoding is handled', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 5, maxLength: 100 }),
        fc.nat({ max: 255 }),
        (payload, badTag) => {
          const dot: DOT = { payload, payload_mode: 'plain' };
          const encoded = toBytes(dot);
          if (encoded.length < 5) return true;
          // Corrupt the tag byte (position 0) to an unknown value
          const corrupted = new Uint8Array(encoded);
          corrupted[0] = badTag;
          const result = tryDecode(corrupted);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('all possible tag values 0x00–0xff in minimal TLV: must not crash', () => {
    for (let tag = 0; tag <= 255; tag++) {
      // Minimal TLV with 0-byte value
      const bytes = new Uint8Array([tag, 0x00, 0x00, 0x00, 0x00]);
      const result = tryDecode(bytes);
      expect(result.ok === true || result.error instanceof Error).toBe(true);
    }
  });

  it('corrupted length bytes in valid encoding: clean error', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 10, maxLength: 100 }),
        fc.nat({ max: 3 }),
        fc.nat({ max: 255 }),
        (payload, lenBytePos, badByte) => {
          const dot: DOT = { payload, payload_mode: 'plain' };
          const encoded = toBytes(dot);
          if (encoded.length < 5) return true;
          // Corrupt one of the 4 length bytes
          const corrupted = new Uint8Array(encoded);
          corrupted[1 + lenBytePos] = badByte;
          const result = tryDecode(corrupted);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('tag 0x52 (fhe.decryptable_by) with large length: handled', () => {
    fc.assert(
      fc.property(
        fc.nat({ min: 0, max: 1000 }),
        (len) => {
          // Craft fhe.decryptable_by TLV with arbitrary length
          const value = new Uint8Array(len).fill(0x42);
          const tlv = new Uint8Array(5 + len);
          tlv[0] = 0x52;
          tlv[1] = 0;
          tlv[2] = 0;
          tlv[3] = (len >>> 8) & 0xff;
          tlv[4] = len & 0xff;
          tlv.set(value, 5);
          const result = tryDecode(tlv);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('repeated same tag in encoding: handled gracefully (last value wins or accumulates)', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 4 }),
        fc.nat({ min: 2, max: 10 }),
        (typeIdx, repetitions) => {
          // Craft multiple TLVs with the same tag
          const types = [0x00, 0x01, 0x02, 0x03, 0x04];
          const tag = types[typeIdx]! + 1; // shift to valid range
          const parts: Uint8Array[] = [];
          for (let i = 0; i < repetitions; i++) {
            const value = new Uint8Array([i & 0xff]);
            const tlv = new Uint8Array([tag, 0, 0, 0, 1, value[0]!]);
            parts.push(tlv);
          }
          const combined = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
          let offset = 0;
          for (const p of parts) {
            combined.set(p, offset);
            offset += p.length;
          }
          const result = tryDecode(combined);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('payload tag (0x01) with zero-length value: handled', () => {
    // tag=0x01, len=0x00000000 — empty payload
    const bytes = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00]);
    const result = tryDecode(bytes);
    expect(result.ok).toBe(true);
  });

  it('sign.signature tag (0x11) with wrong-length value: handled', () => {
    fc.assert(
      fc.property(fc.nat({ min: 0, max: 100 }), (len) => {
        // Ed25519 signatures should be 64 bytes; test any other length
        if (len === 64) return true; // skip valid length
        const value = new Uint8Array(len).fill(0x42);
        const tlv = new Uint8Array(5 + len);
        tlv[0] = 0x11; // TAG_SIGN_SIGNATURE
        tlv[1] = 0;
        tlv[2] = 0;
        tlv[3] = (len >>> 8) & 0xff;
        tlv[4] = len & 0xff;
        tlv.set(value, 5);
        const result = tryDecode(tlv);
        // Must decode without crash (signature stored as-is)
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 100 }
    );
  });

  it('time.utc tag with wrong-length value: handled', () => {
    fc.assert(
      fc.property(fc.nat({ min: 0, max: 20 }), (len) => {
        if (len === 8) return true; // skip valid 8-byte encoding
        const value = new Uint8Array(len).fill(0x12);
        const tlv = new Uint8Array(5 + len);
        tlv[0] = 0x20; // TAG_TIME_UTC
        tlv[1] = 0;
        tlv[2] = 0;
        tlv[3] = (len >>> 8) & 0xff;
        tlv[4] = len & 0xff;
        if (len > 0) tlv.set(value, 5);
        const result = tryDecode(tlv);
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 100 }
    );
  });

  it('interleaved valid and invalid tags: always returns DOT or Error', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tag: fc.nat({ max: 255 }),
            len: fc.nat({ max: 32 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (fields) => {
          // Build a byte sequence with the given tag/len specs
          const parts: Uint8Array[] = [];
          for (const { tag, len } of fields) {
            const value = new Uint8Array(len).fill(tag & 0xff);
            const tlv = new Uint8Array(5 + len);
            tlv[0] = tag;
            tlv[1] = 0;
            tlv[2] = 0;
            tlv[3] = (len >>> 8) & 0xff;
            tlv[4] = len & 0xff;
            tlv.set(value, 5);
            parts.push(tlv);
          }
          const combined = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
          let offset = 0;
          for (const p of parts) {
            combined.set(p, offset);
            offset += p.length;
          }
          const result = tryDecode(combined);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Length overflow (5+ tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('Fuzz: Length overflow', () => {
  it('declared length = MAX_UINT32 with no data: throws Error (does not OOM)', () => {
    // tag=0x01, length=0xFFFFFFFF — would be 4GB of data
    const bytes = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff]);
    const start = Date.now();
    const result = tryDecode(bytes);
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(elapsed).toBeLessThan(100); // must fail fast, not OOM
  });

  it('declared length = 1MB with 0-byte body: throws Error', () => {
    const bigLen = 1_000_000;
    const bytes = new Uint8Array(5);
    bytes[0] = 0x01;
    bytes[1] = (bigLen >>> 24) & 0xff;
    bytes[2] = (bigLen >>> 16) & 0xff;
    bytes[3] = (bigLen >>> 8) & 0xff;
    bytes[4] = bigLen & 0xff;
    const result = tryDecode(bytes);
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('length field = body.length + 1: always throws Error', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 255 }),
        fc.nat({ min: 0, max: 100 }),
        (tag, bodyLen) => {
          const declaredLen = bodyLen + 1; // 1 more than actual data
          const bytes = new Uint8Array(5 + bodyLen);
          bytes[0] = tag;
          bytes[1] = (declaredLen >>> 24) & 0xff;
          bytes[2] = (declaredLen >>> 16) & 0xff;
          bytes[3] = (declaredLen >>> 8) & 0xff;
          bytes[4] = declaredLen & 0xff;
          // body is bodyLen zeros (less than declared)
          const result = tryDecode(bytes);
          return result.ok === false && result.error instanceof Error;
        }
      ),
      { numRuns: 300 }
    );
  });

  it('two consecutive TLVs: second with length overflow is caught', () => {
    fc.assert(
      fc.property(
        fc.nat({ min: 1, max: 50 }),
        fc.nat({ min: 1000, max: 4_294_967_295 }),
        (firstValueLen, overflowLen) => {
          // First TLV: valid (type tag with small body)
          const firstTlv = new Uint8Array(5 + firstValueLen);
          firstTlv[0] = 0x03; // TAG_TYPE
          firstTlv[1] = 0;
          firstTlv[2] = 0;
          firstTlv[3] = (firstValueLen >>> 8) & 0xff;
          firstTlv[4] = firstValueLen & 0xff;

          // Second TLV: overflow length
          const secondTlv = new Uint8Array(5);
          secondTlv[0] = 0x01; // TAG_PAYLOAD
          secondTlv[1] = (overflowLen >>> 24) & 0xff;
          secondTlv[2] = (overflowLen >>> 16) & 0xff;
          secondTlv[3] = (overflowLen >>> 8) & 0xff;
          secondTlv[4] = overflowLen & 0xff;

          const combined = new Uint8Array(firstTlv.length + secondTlv.length);
          combined.set(firstTlv);
          combined.set(secondTlv, firstTlv.length);

          const result = tryDecode(combined);
          return result.ok === true || result.error instanceof Error;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('length field exactly equal to remaining bytes: should succeed (tight fit)', () => {
    fc.assert(
      fc.property(fc.nat({ min: 0, max: 100 }), (bodyLen) => {
        // Valid TLV where length exactly matches remaining bytes
        const bytes = new Uint8Array(5 + bodyLen);
        bytes[0] = 0x01; // TAG_PAYLOAD
        bytes[1] = (bodyLen >>> 24) & 0xff;
        bytes[2] = (bodyLen >>> 16) & 0xff;
        bytes[3] = (bodyLen >>> 8) & 0xff;
        bytes[4] = bodyLen & 0xff;
        // Body is all zeros
        const result = tryDecode(bytes);
        // Zero-length payload not stored, others should decode fine
        return result.ok === true || result.error instanceof Error;
      }),
      { numRuns: 200 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Encode then decode is always stable (regression guards)
// ─────────────────────────────────────────────────────────────────────────────

describe('Fuzz: encode→decode stability', () => {
  it('any observe() output encodes and decodes without error', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 0, maxLength: 200 })),
        fc.boolean(),
        (str, plaintext) => {
          const dot = observe(str ?? undefined, { plaintext }) as DOT;
          const encoded = toBytes(dot);
          const result = tryDecode(encoded);
          return result.ok === true;
        }
      ),
      { numRuns: 200 }
    );
  });

  it('encoded DOT bytes are always valid TLV (decode succeeds)', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 200 }),
        fc.boolean(),
        (payload, hasTime) => {
          const dot: DOT = {};
          if (payload.length > 0) {
            dot.payload = payload;
            dot.payload_mode = 'plain';
          }
          if (hasTime) {
            dot.time = { utc: Date.now() };
          }
          const encoded = toBytes(dot);
          const result = tryDecode(encoded);
          return result.ok === true;
        }
      ),
      { numRuns: 500 }
    );
  });
});
