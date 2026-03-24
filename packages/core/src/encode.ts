/**
 * encode.ts — Variable-length TLV (Type-Length-Value) encoding for DOTs.
 *
 * R854: NOT 153 bytes (that was v0.3.0). DOTs are variable-length.
 * An empty DOT encodes to 0 bytes. Overhead is <256 bytes for full DOTs.
 *
 * TLV wire format:
 *   [tag: 1 byte][length: 4 bytes big-endian][value: N bytes]
 *
 * Using 4-byte lengths to support payloads up to 4GB.
 *
 * Tag assignments:
 *   0x01 = payload
 *   0x02 = payload_mode
 *   0x03 = type
 *   0x10 = sign.observer
 *   0x11 = sign.signature
 *   0x12 = sign.level
 *   0x20 = time.utc
 *   0x21 = time.monotonic
 *   0x30 = chain.previous
 *   0x31 = chain.depth
 *   0x40 = verify.hash
 *   0x50 = fhe.scheme
 *   0x51 = fhe.eval_key_hash
 *   0x52 = fhe.decryptable_by (one entry per occurrence)
 */

import type { DOT, ObservationType, PayloadMode, IdentityLevel } from './types.js';

// Tag byte constants
const TAG_PAYLOAD = 0x01;
const TAG_PAYLOAD_MODE = 0x02;
const TAG_TYPE = 0x03;
const TAG_SIGN_OBSERVER = 0x10;
const TAG_SIGN_SIGNATURE = 0x11;
const TAG_SIGN_LEVEL = 0x12;
const TAG_TIME_UTC = 0x20;
const TAG_TIME_MONOTONIC = 0x21;
const TAG_CHAIN_PREVIOUS = 0x30;
const TAG_CHAIN_DEPTH = 0x31;
const TAG_VERIFY_HASH = 0x40;
const TAG_FHE_SCHEME = 0x50;
const TAG_FHE_EVAL_KEY_HASH = 0x51;
const TAG_FHE_DECRYPTABLE_BY = 0x52;

const PAYLOAD_MODES: PayloadMode[] = ['fhe', 'plain', 'none'];
const OBS_TYPES: ObservationType[] = ['measure', 'state', 'event', 'claim', 'bond'];
const IDENTITY_LEVELS: IdentityLevel[] = ['absent', 'ephemeral', 'anonymous', 'pseudonymous', 'real'];
const FHE_SCHEMES = ['tfhe'] as const;

/** Encode a single TLV field: [tag][4-byte length big-endian][value]. */
function tlv(tag: number, value: Uint8Array): Uint8Array {
  const len = value.length;
  const out = new Uint8Array(5 + len);
  out[0] = tag;
  // 4-byte big-endian length
  out[1] = (len >>> 24) & 0xff;
  out[2] = (len >>> 16) & 0xff;
  out[3] = (len >>> 8) & 0xff;
  out[4] = len & 0xff;
  out.set(value, 5);
  return out;
}

/** Encode an 8-byte big-endian number. */
function encodeNumber(n: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const hi = Math.floor(n / 0x100000000);
  const lo = n >>> 0;
  view.setUint32(0, hi, false);
  view.setUint32(4, lo, false);
  return new Uint8Array(buf);
}

/** Decode an 8-byte big-endian number. */
function decodeNumber(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hi = view.getUint32(0, false);
  const lo = view.getUint32(4, false);
  return hi * 0x100000000 + lo;
}

/** Concatenate multiple Uint8Arrays into one. */
function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encodes a DOT to its canonical TLV byte representation.
 *
 * An empty DOT encodes to 0 bytes. Only present fields are encoded.
 * Fields are encoded in deterministic tag order.
 *
 * @param dot - The DOT to encode
 * @returns Encoded bytes (0 bytes for an empty DOT)
 */
export function toBytes(dot: DOT): Uint8Array {
  const fields: Uint8Array[] = [];

  // 0x01: payload
  if (dot.payload !== undefined && dot.payload.length > 0) {
    fields.push(tlv(TAG_PAYLOAD, dot.payload));
  }

  // 0x02: payload_mode (as 1 byte index)
  if (dot.payload_mode !== undefined) {
    const idx = PAYLOAD_MODES.indexOf(dot.payload_mode);
    if (idx >= 0) {
      fields.push(tlv(TAG_PAYLOAD_MODE, new Uint8Array([idx])));
    }
  }

  // 0x03: type (as 1 byte index)
  if (dot.type !== undefined) {
    const idx = OBS_TYPES.indexOf(dot.type);
    if (idx >= 0) {
      fields.push(tlv(TAG_TYPE, new Uint8Array([idx])));
    }
  }

  // 0x10: sign.observer
  if (dot.sign?.observer !== undefined) {
    fields.push(tlv(TAG_SIGN_OBSERVER, dot.sign.observer));
  }

  // 0x11: sign.signature
  if (dot.sign?.signature !== undefined) {
    fields.push(tlv(TAG_SIGN_SIGNATURE, dot.sign.signature));
  }

  // 0x12: sign.level (as 1 byte index)
  if (dot.sign?.level !== undefined) {
    const idx = IDENTITY_LEVELS.indexOf(dot.sign.level);
    if (idx >= 0) {
      fields.push(tlv(TAG_SIGN_LEVEL, new Uint8Array([idx])));
    }
  }

  // 0x20: time.utc (8 bytes)
  if (dot.time?.utc !== undefined) {
    fields.push(tlv(TAG_TIME_UTC, encodeNumber(dot.time.utc)));
  }

  // 0x21: time.monotonic (8 bytes)
  if (dot.time?.monotonic !== undefined) {
    fields.push(tlv(TAG_TIME_MONOTONIC, encodeNumber(dot.time.monotonic)));
  }

  // 0x30: chain.previous (32 bytes)
  if (dot.chain?.previous !== undefined) {
    fields.push(tlv(TAG_CHAIN_PREVIOUS, dot.chain.previous));
  }

  // 0x31: chain.depth (8 bytes)
  if (dot.chain?.depth !== undefined) {
    fields.push(tlv(TAG_CHAIN_DEPTH, encodeNumber(dot.chain.depth)));
  }

  // 0x40: verify.hash (32 bytes)
  if (dot.verify?.hash !== undefined) {
    fields.push(tlv(TAG_VERIFY_HASH, dot.verify.hash));
  }

  // 0x50: fhe.scheme (string)
  if (dot.fhe?.scheme !== undefined) {
    fields.push(tlv(TAG_FHE_SCHEME, encoder.encode(dot.fhe.scheme)));
  }

  // 0x51: fhe.eval_key_hash (32 bytes)
  if (dot.fhe?.eval_key_hash !== undefined) {
    fields.push(tlv(TAG_FHE_EVAL_KEY_HASH, dot.fhe.eval_key_hash));
  }

  // 0x52: fhe.decryptable_by (one TLV per key)
  if (dot.fhe?.decryptable_by !== undefined) {
    for (const key of dot.fhe.decryptable_by) {
      fields.push(tlv(TAG_FHE_DECRYPTABLE_BY, key));
    }
  }

  return concat(fields);
}

/**
 * Decodes a DOT from its TLV byte representation.
 *
 * Gracefully handles truncated or malformed input — unknown tags are skipped.
 * An empty byte array decodes to an empty DOT `{}`.
 *
 * @param bytes - The encoded DOT bytes
 * @returns Decoded DOT
 * @throws {Error} If the TLV framing is malformed (e.g., declared length exceeds buffer)
 */
export function fromBytes(bytes: Uint8Array): DOT {
  const dot: DOT = {};

  let pos = 0;
  while (pos < bytes.length) {
    // Need at least 5 bytes for a TLV header (1 tag + 4 length)
    if (pos + 5 > bytes.length) {
      throw new Error(`Malformed TLV: incomplete header at offset ${pos}`);
    }

    const tag = bytes[pos];
    if (tag === undefined) throw new Error(`Malformed TLV: undefined tag at offset ${pos}`);

    const b1 = bytes[pos + 1];
    const b2 = bytes[pos + 2];
    const b3 = bytes[pos + 3];
    const b4 = bytes[pos + 4];
    if (b1 === undefined || b2 === undefined || b3 === undefined || b4 === undefined) {
      throw new Error(`Malformed TLV: incomplete length at offset ${pos}`);
    }
    const len = ((b1 << 24) | (b2 << 16) | (b3 << 8) | b4) >>> 0;
    pos += 5;

    if (pos + len > bytes.length) {
      throw new Error(`Malformed TLV: declared length ${len} at offset ${pos - 3} exceeds buffer`);
    }

    const value = bytes.slice(pos, pos + len);
    pos += len;

    switch (tag) {
      case TAG_PAYLOAD:
        dot.payload = value;
        break;

      case TAG_PAYLOAD_MODE: {
        const idx = value[0];
        if (idx !== undefined && idx < PAYLOAD_MODES.length) {
          dot.payload_mode = PAYLOAD_MODES[idx];
        }
        break;
      }

      case TAG_TYPE: {
        const idx = value[0];
        if (idx !== undefined && idx < OBS_TYPES.length) {
          dot.type = OBS_TYPES[idx];
        }
        break;
      }

      case TAG_SIGN_OBSERVER:
        if (!dot.sign) dot.sign = {};
        dot.sign.observer = value;
        break;

      case TAG_SIGN_SIGNATURE:
        if (!dot.sign) dot.sign = {};
        dot.sign.signature = value;
        break;

      case TAG_SIGN_LEVEL: {
        const idx = value[0];
        if (!dot.sign) dot.sign = {};
        if (idx !== undefined && idx < IDENTITY_LEVELS.length) {
          dot.sign.level = IDENTITY_LEVELS[idx];
        }
        break;
      }

      case TAG_TIME_UTC:
        if (!dot.time) dot.time = {};
        dot.time.utc = decodeNumber(value);
        break;

      case TAG_TIME_MONOTONIC:
        if (!dot.time) dot.time = {};
        dot.time.monotonic = decodeNumber(value);
        break;

      case TAG_CHAIN_PREVIOUS:
        if (!dot.chain) dot.chain = {};
        dot.chain.previous = value;
        break;

      case TAG_CHAIN_DEPTH:
        if (!dot.chain) dot.chain = {};
        dot.chain.depth = decodeNumber(value);
        break;

      case TAG_VERIFY_HASH:
        if (!dot.verify) dot.verify = {};
        dot.verify.hash = value;
        break;

      case TAG_FHE_SCHEME: {
        if (!dot.fhe) dot.fhe = {};
        const scheme = decoder.decode(value);
        if (FHE_SCHEMES.includes(scheme as 'tfhe')) {
          dot.fhe.scheme = scheme as 'tfhe';
        }
        break;
      }

      case TAG_FHE_EVAL_KEY_HASH:
        if (!dot.fhe) dot.fhe = {};
        dot.fhe.eval_key_hash = value;
        break;

      case TAG_FHE_DECRYPTABLE_BY:
        if (!dot.fhe) dot.fhe = {};
        if (!dot.fhe.decryptable_by) dot.fhe.decryptable_by = [];
        dot.fhe.decryptable_by.push(value);
        break;

      default:
        // Unknown tag — skip gracefully
        break;
    }
  }

  return dot;
}
