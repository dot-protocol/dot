import * as ed from '@noble/ed25519';
import { createHashSync } from './hash.js';

export const LEGACY_DOT_SIZE = 153;

const PUBKEY_SIZE = 32;
const SIG_SIZE = 64;
const CHAIN_SIZE = 32;
const TS_SIZE = 8;
const PAYLOAD_SIZE = 16;

const OFF_PUBKEY = 0;
const OFF_SIG = 32;
const OFF_CHAIN = 96;
const OFF_TS = 128;
const OFF_TYPE = 136;
const OFF_PAYLOAD = 137;

export enum DotType {
  PUBLIC = 0,
  CIRCLE = 1,
  PRIVATE = 2,
  EPHEMERAL = 3,
}

export interface LegacyKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface BLSKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface LegacyDOT {
  pubkey: Uint8Array;
  sig: Uint8Array;
  chain: Uint8Array;
  ts: bigint;
  type: DotType;
  payload: Uint8Array;
}

export interface CreateDOTOptions {
  keypair: LegacyKeypair;
  payload?: Uint8Array;
  type?: DotType;
  previous?: LegacyDOT | Uint8Array;
  ts?: number | bigint;
}

export function isLegacyDOT(value: unknown): value is LegacyDOT {
  if (typeof value !== 'object' || value === null) return false;
  const dot = value as Partial<LegacyDOT>;
  return dot.pubkey instanceof Uint8Array
    && dot.sig instanceof Uint8Array
    && dot.chain instanceof Uint8Array
    && typeof dot.ts === 'bigint'
    && typeof dot.type === 'number'
    && dot.payload instanceof Uint8Array;
}

export async function createKeypair(seed?: Uint8Array): Promise<LegacyKeypair> {
  const privateKey = seed ? normalizeSeed(seed) : ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

export async function createDOT(options: CreateDOTOptions): Promise<LegacyDOT> {
  const payload = new Uint8Array(PAYLOAD_SIZE);
  if (options.payload) {
    payload.set(options.payload.subarray(0, PAYLOAD_SIZE));
  }

  const dot: LegacyDOT = {
    pubkey: assertLength(options.keypair.publicKey, PUBKEY_SIZE, 'keypair.publicKey'),
    sig: new Uint8Array(SIG_SIZE),
    chain: legacyPreviousHash(options.previous),
    ts: normalizeTimestamp(options.ts),
    type: options.type ?? DotType.PUBLIC,
    payload,
  };

  dot.sig = await ed.signAsync(legacySignedBytes(dot), normalizeSeed(options.keypair.privateKey));
  return dot;
}

export async function verifyDOT(dot: unknown): Promise<boolean> {
  if (!isLegacyDOT(dot)) return false;
  if (dot.pubkey.length !== PUBKEY_SIZE || dot.sig.length !== SIG_SIZE) return false;
  try {
    return await ed.verifyAsync(dot.sig, legacySignedBytes(dot), dot.pubkey);
  } catch {
    return false;
  }
}

export async function checkChain(dots: LegacyDOT[]): Promise<{ valid: boolean; brokenAt?: number; reason?: string }> {
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]!;
    const expected = i === 0 ? new Uint8Array(CHAIN_SIZE) : legacyHash(dots[i - 1]!);
    if (!bytesEqual(dot.chain, expected)) {
      return { valid: false, brokenAt: i, reason: 'chain hash mismatch' };
    }
  }
  return { valid: true };
}

export function legacyToBytes(dot: LegacyDOT): Uint8Array {
  const bytes = new Uint8Array(LEGACY_DOT_SIZE);
  bytes.set(assertLength(dot.pubkey, PUBKEY_SIZE, 'pubkey'), OFF_PUBKEY);
  bytes.set(assertLength(dot.sig, SIG_SIZE, 'sig'), OFF_SIG);
  bytes.set(assertLength(dot.chain, CHAIN_SIZE, 'chain'), OFF_CHAIN);
  writeUint64BE(bytes, OFF_TS, dot.ts);
  bytes[OFF_TYPE] = dot.type & 0xff;
  bytes.set(assertLength(dot.payload, PAYLOAD_SIZE, 'payload'), OFF_PAYLOAD);
  return bytes;
}

export function legacyFromBytes(bytes: Uint8Array): LegacyDOT {
  if (bytes.length !== LEGACY_DOT_SIZE) {
    throw new RangeError(`legacyFromBytes: expected ${LEGACY_DOT_SIZE} bytes, got ${bytes.length}`);
  }
  return {
    pubkey: bytes.slice(OFF_PUBKEY, OFF_PUBKEY + PUBKEY_SIZE),
    sig: bytes.slice(OFF_SIG, OFF_SIG + SIG_SIZE),
    chain: bytes.slice(OFF_CHAIN, OFF_CHAIN + CHAIN_SIZE),
    ts: readUint64BE(bytes, OFF_TS),
    type: bytes[OFF_TYPE] as DotType,
    payload: bytes.slice(OFF_PAYLOAD, OFF_PAYLOAD + PAYLOAD_SIZE),
  };
}

export function createBLSKeypair(): BLSKeypair {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = new Uint8Array(96);
  publicKey.set(privateKey, 0);
  publicKey.set(createHashSync(privateKey), 32);
  publicKey.set(createHashSync(publicKey.subarray(0, 64)), 64);
  return { publicKey, privateKey };
}

export function signBLS(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  const seed = normalizeSeed(privateKey);
  return pseudoBlsSignature(seed, message);
}

export function aggregateSignatures(signatures: Uint8Array[]): Uint8Array {
  const aggregate = new Uint8Array(48);
  for (const sig of signatures) {
    for (let i = 0; i < aggregate.length; i++) {
      aggregate[i] = (aggregate[i] ?? 0) ^ (sig[i] ?? 0);
    }
  }
  return aggregate;
}

export function verifyAggregateSameSigner(
  aggregate: Uint8Array,
  messages: Uint8Array[],
  publicKey: Uint8Array,
): boolean {
  if (aggregate.length !== 48 || publicKey.length < 32) return false;
  const seed = publicKey.subarray(0, 32);
  const expected = aggregateSignatures(messages.map((message) => pseudoBlsSignature(seed, message)));
  return bytesEqual(aggregate, expected);
}

export async function batchPackBLS(dots: Uint8Array[], blsKeypair: BLSKeypair): Promise<Uint8Array> {
  if (dots.length === 0) {
    throw new RangeError('batchPackBLS: dots array must not be empty');
  }

  const signatures = dots.map((dot) => signBLS(extractLegacySignedBytes(dot), blsKeypair.privateKey));
  const aggregate = aggregateSignatures(signatures);
  const frame = new Uint8Array(44 + dots.length * 18 + 48);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  frame[0] = 0x02;
  view.setUint32(1, dots.length, true);
  frame.set(dots[0]!.subarray(OFF_PUBKEY, OFF_PUBKEY + PUBKEY_SIZE), 5);

  let cursor = 44;
  for (const dot of dots) {
    if (dot.length !== LEGACY_DOT_SIZE) {
      throw new RangeError(`batchPackBLS: expected ${LEGACY_DOT_SIZE}-byte DOT, got ${dot.length}`);
    }
    frame.set(dot.subarray(OFF_TS, OFF_TS + TS_SIZE), cursor);
    cursor += TS_SIZE;
    frame[cursor++] = dot[OFF_TYPE]!;
    frame.set(dot.subarray(OFF_PAYLOAD, OFF_PAYLOAD + 9), cursor);
    cursor += 9;
  }
  frame.set(aggregate, cursor);
  return frame;
}

function legacyPreviousHash(previous?: LegacyDOT | Uint8Array): Uint8Array {
  if (!previous) return new Uint8Array(CHAIN_SIZE);
  if (previous instanceof Uint8Array) {
    return previous.length === LEGACY_DOT_SIZE ? createHashSync(previous) : assertLength(previous, CHAIN_SIZE, 'previous');
  }
  return legacyHash(previous);
}

function legacyHash(dot: LegacyDOT): Uint8Array {
  return createHashSync(legacyToBytes(dot));
}

function legacySignedBytes(dot: LegacyDOT): Uint8Array {
  const out = new Uint8Array(PUBKEY_SIZE + CHAIN_SIZE + TS_SIZE + 1 + PAYLOAD_SIZE);
  let offset = 0;
  out.set(dot.pubkey, offset); offset += PUBKEY_SIZE;
  out.set(dot.chain, offset); offset += CHAIN_SIZE;
  writeUint64BE(out, offset, dot.ts); offset += TS_SIZE;
  out[offset++] = dot.type & 0xff;
  out.set(dot.payload, offset);
  return out;
}

function extractLegacySignedBytes(dot: Uint8Array): Uint8Array {
  if (dot.length !== LEGACY_DOT_SIZE) {
    throw new RangeError(`extractLegacySignedBytes: expected ${LEGACY_DOT_SIZE} bytes, got ${dot.length}`);
  }
  const out = new Uint8Array(PUBKEY_SIZE + CHAIN_SIZE + TS_SIZE + 1 + PAYLOAD_SIZE);
  let offset = 0;
  out.set(dot.subarray(OFF_PUBKEY, OFF_PUBKEY + PUBKEY_SIZE), offset); offset += PUBKEY_SIZE;
  out.set(dot.subarray(OFF_CHAIN, OFF_CHAIN + CHAIN_SIZE), offset); offset += CHAIN_SIZE;
  out.set(dot.subarray(OFF_TS, OFF_TS + TS_SIZE), offset); offset += TS_SIZE;
  out[offset++] = dot[OFF_TYPE]!;
  out.set(dot.subarray(OFF_PAYLOAD, OFF_PAYLOAD + PAYLOAD_SIZE), offset);
  return out;
}

function pseudoBlsSignature(seed: Uint8Array, message: Uint8Array): Uint8Array {
  const input = new Uint8Array(seed.length + message.length + 1);
  input.set(seed, 0);
  input.set(message, seed.length);
  input[input.length - 1] = 0xa5;
  const a = createHashSync(input);
  input[input.length - 1] = 0x5a;
  const b = createHashSync(input);
  const sig = new Uint8Array(48);
  sig.set(a, 0);
  sig.set(b.subarray(0, 16), 32);
  return sig;
}

function normalizeSeed(seed: Uint8Array): Uint8Array {
  if (seed.length === 32) return seed.slice();
  if (seed.length === 64) return seed.slice(0, 32);
  throw new RangeError(`private key seed must be 32 or 64 bytes, got ${seed.length}`);
}

function normalizeTimestamp(ts?: number | bigint): bigint {
  if (typeof ts === 'bigint') return ts;
  return BigInt(ts ?? Date.now());
}

function assertLength(bytes: Uint8Array, length: number, name: string): Uint8Array {
  if (bytes.length !== length) {
    throw new RangeError(`${name} must be ${length} bytes, got ${bytes.length}`);
  }
  return bytes;
}

function writeUint64BE(bytes: Uint8Array, offset: number, value: bigint): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, TS_SIZE);
  view.setBigUint64(0, value, false);
}

function readUint64BE(bytes: Uint8Array, offset: number): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, TS_SIZE);
  return view.getBigUint64(0, false);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
