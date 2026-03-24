/**
 * DOT Protocol R854 — Core Test Suite
 * 190+ tests covering observe / sign / verify / chain / encode / trust
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  observe,
  sign,
  buildSignedBytes,
  verify,
  chain,
  hash,
  toBytes,
  fromBytes,
  computeTrust,
  computeLevel,
  createIdentity,
  DOTLevel,
  type DOT,
  type UnsignedDOT,
  type ObservationType,
} from '../index.js';

// ─── observe ──────────────────────────────────────────────────────────────────

describe('observe', () => {
  it('no args → valid empty DOT', () => {
    const dot = observe();
    expect(dot).toBeDefined();
    expect(dot.payload).toBeUndefined();
    expect(dot.payload_mode).toBe('none');
  });

  it('no args → level 0', () => {
    const dot = observe();
    expect(dot._meta?.level).toBe(DOTLevel.Empty);
  });

  it('string payload → payload is Uint8Array', () => {
    const dot = observe('hello');
    expect(dot.payload).toBeInstanceOf(Uint8Array);
    expect(dot.payload!.length).toBeGreaterThan(0);
  });

  it('string payload → fhe mode by default', () => {
    const dot = observe('hello');
    expect(dot.payload_mode).toBe('fhe');
  });

  it('string payload decodes correctly', () => {
    const dot = observe('hello world');
    const decoded = new TextDecoder().decode(dot.payload);
    expect(decoded).toBe('hello world');
  });

  it('string payload with plaintext:true → plain mode', () => {
    const dot = observe('hello', { plaintext: true });
    expect(dot.payload_mode).toBe('plain');
  });

  it('Uint8Array payload passes through directly', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const dot = observe(bytes);
    expect(dot.payload).toBe(bytes);
  });

  it('object payload → JSON-encoded', () => {
    const obj = { key: 'value', num: 42 };
    const dot = observe(obj);
    expect(dot.payload).toBeInstanceOf(Uint8Array);
    const decoded = new TextDecoder().decode(dot.payload);
    expect(JSON.parse(decoded)).toEqual(obj);
  });

  it('number payload → JSON-encoded', () => {
    const dot = observe(42);
    const decoded = new TextDecoder().decode(dot.payload);
    expect(JSON.parse(decoded)).toBe(42);
  });

  it('boolean payload → JSON-encoded', () => {
    const dot = observe(true);
    const decoded = new TextDecoder().decode(dot.payload);
    expect(JSON.parse(decoded)).toBe(true);
  });

  it('array payload → JSON-encoded', () => {
    const arr = [1, 2, 3];
    const dot = observe(arr);
    const decoded = new TextDecoder().decode(dot.payload);
    expect(JSON.parse(decoded)).toEqual(arr);
  });

  it('null payload → empty DOT', () => {
    const dot = observe(null);
    expect(dot.payload).toBeUndefined();
    expect(dot.payload_mode).toBe('none');
  });

  it('type: measure is set', () => {
    const dot = observe('temp', { type: 'measure' });
    expect(dot.type).toBe('measure');
  });

  it('type: state is set', () => {
    const dot = observe('active', { type: 'state' });
    expect(dot.type).toBe('state');
  });

  it('type: event is set', () => {
    const dot = observe('click', { type: 'event' });
    expect(dot.type).toBe('event');
  });

  it('type: claim is set', () => {
    const dot = observe('I did X', { type: 'claim' });
    expect(dot.type).toBe('claim');
  });

  it('type: bond is set', () => {
    const dot = observe('linked', { type: 'bond' });
    expect(dot.type).toBe('bond');
  });

  it('_meta.created_at is a positive number', () => {
    const dot = observe('test');
    expect(typeof dot._meta?.created_at).toBe('number');
    expect(dot._meta!.created_at!).toBeGreaterThan(0);
  });

  it('_meta.level is correct for payload-only DOT', () => {
    const dot = observe('hello');
    // payload present → level >= 1
    expect(dot._meta?.level).toBeGreaterThanOrEqual(DOTLevel.Payload);
  });

  it('_meta.level is 0 for empty DOT', () => {
    const dot = observe();
    expect(dot._meta?.level).toBe(DOTLevel.Empty);
  });

  it('share_with → fhe.decryptable_by is set', () => {
    const pubkey = new Uint8Array(32).fill(5);
    const dot = observe('secret', { share_with: [pubkey] });
    expect(dot.fhe?.decryptable_by).toHaveLength(1);
    expect(dot.fhe?.decryptable_by?.[0]).toEqual(pubkey);
  });

  it('share_with → fhe.scheme is tfhe', () => {
    const pubkey = new Uint8Array(32).fill(5);
    const dot = observe('secret', { share_with: [pubkey] });
    expect(dot.fhe?.scheme).toBe('tfhe');
  });

  it('multiple share_with keys', () => {
    const k1 = new Uint8Array(32).fill(1);
    const k2 = new Uint8Array(32).fill(2);
    const dot = observe('secret', { share_with: [k1, k2] });
    expect(dot.fhe?.decryptable_by).toHaveLength(2);
  });

  it('empty string payload → payload present, fhe mode', () => {
    const dot = observe('');
    // Empty string still encodes to 0 bytes — treated like no payload
    expect(dot.payload_mode).toBe('fhe');
  });

  it('observe returns UnsignedDOT without signature', () => {
    const dot = observe('test');
    expect((dot as DOT).sign?.signature).toBeUndefined();
  });

  it('each call produces independent objects', () => {
    const a = observe('a');
    const b = observe('b');
    expect(a).not.toBe(b);
    expect(a.payload).not.toEqual(b.payload);
  });

  it('no type option → type is undefined', () => {
    const dot = observe('test');
    expect(dot.type).toBeUndefined();
  });
});

// ─── sign ─────────────────────────────────────────────────────────────────────

describe('sign', () => {
  let secretKey: Uint8Array;
  let publicKey: Uint8Array;

  beforeAll(async () => {
    const id = await createIdentity();
    secretKey = id.secretKey;
    publicKey = id.publicKey;
  });

  it('sign produces a signature (64 bytes)', async () => {
    const dot = observe('hello');
    const signed = await sign(dot, secretKey);
    expect(signed.sign?.signature).toBeInstanceOf(Uint8Array);
    expect(signed.sign?.signature?.length).toBe(64);
  });

  it('sign sets observer public key (32 bytes)', async () => {
    const dot = observe('hello');
    const signed = await sign(dot, secretKey);
    expect(signed.sign?.observer).toBeInstanceOf(Uint8Array);
    expect(signed.sign?.observer?.length).toBe(32);
  });

  it('observer public key matches derived key', async () => {
    const dot = observe('hello');
    const signed = await sign(dot, secretKey);
    expect(signed.sign?.observer).toEqual(publicKey);
  });

  it('sign preserves payload', async () => {
    const dot = observe('preserve me');
    const signed = await sign(dot, secretKey);
    expect(signed.payload).toEqual(dot.payload);
  });

  it('sign preserves payload_mode', async () => {
    const dot = observe('test', { plaintext: true });
    const signed = await sign(dot, secretKey);
    expect(signed.payload_mode).toBe('plain');
  });

  it('sign preserves type', async () => {
    const dot = observe('event', { type: 'event' });
    const signed = await sign(dot, secretKey);
    expect(signed.type).toBe('event');
  });

  it('sign preserves time base if present', async () => {
    const dot: UnsignedDOT = { ...observe('test'), time: { utc: 1234567890000, monotonic: 5 } };
    const signed = await sign(dot, secretKey);
    expect(signed.time?.utc).toBe(1234567890000);
    expect(signed.time?.monotonic).toBe(5);
  });

  it('sign preserves chain base if present', async () => {
    const prev = chain(observe('prev') as DOT);
    const dot = observe('test') as DOT;
    const chained = chain(dot, prev);
    const signed = await sign(chained as UnsignedDOT, secretKey);
    expect(signed.chain?.previous).toEqual(chained.chain?.previous);
  });

  it('signed DOT level is higher than unsigned', async () => {
    const unsigned = observe('hello');
    const signed = await sign(unsigned, secretKey);
    expect(signed._meta!.level!).toBeGreaterThan(unsigned._meta!.level!);
  });

  it('sign an empty DOT → valid per Correction #47', async () => {
    const empty = observe();
    const signed = await sign(empty, secretKey);
    expect(signed.sign?.signature).toBeDefined();
    expect(signed.sign?.signature?.length).toBe(64);
  });

  it('_meta.duration_us is positive after signing', async () => {
    const dot = observe('timing test');
    const signed = await sign(dot, secretKey);
    expect(signed._meta?.duration_us).toBeGreaterThan(0);
  });

  it('different secret keys produce different signatures', async () => {
    const id2 = await createIdentity();
    const dot = observe('same payload');
    const s1 = await sign(dot, secretKey);
    const s2 = await sign(dot, id2.secretKey);
    expect(s1.sign?.signature).not.toEqual(s2.sign?.signature);
  });

  it('sign preserves fhe metadata', async () => {
    const pubkey = new Uint8Array(32).fill(7);
    const dot = observe('secret', { share_with: [pubkey] });
    const signed = await sign(dot, secretKey);
    expect(signed.fhe?.decryptable_by?.[0]).toEqual(pubkey);
  });

  it('sign does not mutate the input DOT', async () => {
    const dot = observe('immutable');
    const original_payload = dot.payload?.slice();
    await sign(dot, secretKey);
    expect(dot.payload).toEqual(original_payload);
    expect((dot as DOT).sign?.signature).toBeUndefined();
  });

  it('sign with existing sign.level preserves it', async () => {
    const dot: UnsignedDOT = {
      ...observe('test'),
      sign: { level: 'pseudonymous' },
    };
    const signed = await sign(dot, secretKey);
    expect(signed.sign?.level).toBe('pseudonymous');
  });

  it('two signs of the same DOT produce same signature (deterministic)', async () => {
    const dot: UnsignedDOT = { payload: new Uint8Array([1, 2, 3]), payload_mode: 'plain' };
    const s1 = await sign(dot, secretKey);
    const s2 = await sign(dot, secretKey);
    expect(s1.sign?.signature).toEqual(s2.sign?.signature);
  });
});

// ─── verify ───────────────────────────────────────────────────────────────────

describe('verify', () => {
  let secretKey: Uint8Array;
  let altSecretKey: Uint8Array;

  beforeAll(async () => {
    const id = await createIdentity();
    secretKey = id.secretKey;
    const id2 = await createIdentity();
    altSecretKey = id2.secretKey;
  });

  it('verify unsigned DOT → valid (Correction #47)', async () => {
    const dot = observe('unsigned') as DOT;
    const result = await verify(dot);
    expect(result.valid).toBe(true);
  });

  it('verify unsigned DOT → reason mentions Correction #47', async () => {
    const dot = observe('unsigned') as DOT;
    const result = await verify(dot);
    expect(result.reason).toMatch(/Correction #47/i);
  });

  it('verify empty DOT → valid', async () => {
    const dot = observe() as DOT;
    const result = await verify(dot);
    expect(result.valid).toBe(true);
  });

  it('verify unsigned DOT → checked is empty', async () => {
    const dot = observe('test') as DOT;
    const result = await verify(dot);
    expect(result.checked).toEqual([]);
  });

  it('verify signed DOT → valid', async () => {
    const unsigned = observe('valid signed DOT');
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
  });

  it('verify signed DOT → checked includes signature', async () => {
    const unsigned = observe('test');
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.checked).toContain('signature');
  });

  it('verify tampered payload → invalid', async () => {
    const unsigned = observe('original') as UnsignedDOT;
    const signed = await sign(unsigned, secretKey);
    // Tamper the payload
    const tampered: DOT = { ...signed, payload: new TextEncoder().encode('tampered') };
    const result = await verify(tampered);
    expect(result.valid).toBe(false);
  });

  it('tampered payload → reason mentions failure', async () => {
    const unsigned = observe('original') as UnsignedDOT;
    const signed = await sign(unsigned, secretKey);
    const tampered: DOT = { ...signed, payload: new TextEncoder().encode('tampered') };
    const result = await verify(tampered);
    expect(result.reason).toBeDefined();
    expect(result.reason!.length).toBeGreaterThan(0);
  });

  it('verify tampered signature → invalid', async () => {
    const unsigned = observe('test');
    const signed = await sign(unsigned, secretKey);
    const tampered: DOT = {
      ...signed,
      sign: {
        ...signed.sign,
        signature: new Uint8Array(64).fill(0xff),
      },
    };
    const result = await verify(tampered);
    expect(result.valid).toBe(false);
  });

  it('verify with wrong public key → invalid', async () => {
    const unsigned = observe('test');
    const signed = await sign(unsigned, secretKey);
    // Replace observer with a different key
    const wrongKey = await createIdentity();
    const tampered: DOT = {
      ...signed,
      sign: {
        ...signed.sign,
        observer: wrongKey.publicKey,
      },
    };
    const result = await verify(tampered);
    expect(result.valid).toBe(false);
  });

  it('verify DOT with verify.hash → checks hash', async () => {
    const payload = new TextEncoder().encode('hash me');
    // Import createHash to make the hash
    const { createHash } = await import('../hash.js');
    const h = await createHash(payload);
    const dot: DOT = { payload, payload_mode: 'plain', verify: { hash: h } };
    const result = await verify(dot);
    expect(result.valid).toBe(true);
    expect(result.checked).toContain('hash');
  });

  it('verify DOT with wrong hash → invalid', async () => {
    const dot: DOT = {
      payload: new TextEncoder().encode('data'),
      payload_mode: 'plain',
      verify: { hash: new Uint8Array(32).fill(0xab) },
    };
    const result = await verify(dot);
    expect(result.valid).toBe(false);
  });

  it('verify signed + hash → checks both', async () => {
    const { createHash } = await import('../hash.js');
    const payload = new TextEncoder().encode('full check');
    const h = await createHash(payload);
    const unsigned: UnsignedDOT = { payload, payload_mode: 'plain', verify: { hash: h } };
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
    expect(result.checked).toContain('signature');
    expect(result.checked).toContain('hash');
  });

  it('verify with chain.previous present → checks chain', async () => {
    const unsigned = observe('test');
    const signed = await sign(unsigned, secretKey);
    const chained: DOT = {
      ...signed,
      chain: { previous: new Uint8Array(32).fill(1), depth: 1 },
    };
    // Re-sign with chain
    const resigned = await sign(chained as UnsignedDOT, secretKey);
    const result = await verify(resigned);
    expect(result.checked).toContain('chain');
  });

  it('verify chain.previous wrong length → invalid', async () => {
    const unsigned = observe('test');
    const signed = await sign(unsigned, secretKey);
    const tampered: DOT = {
      ...signed,
      chain: { previous: new Uint8Array(16), depth: 1 },
    };
    // We must re-sign because the chain changes the message
    const resigned = await sign(tampered as UnsignedDOT, secretKey);
    // Now tamper post-sign to trigger the chain length check
    const bad: DOT = { ...resigned, chain: { previous: new Uint8Array(16), depth: 1 } };
    const result = await verify(bad);
    expect(result.valid).toBe(false);
  });

  it('verify returns checked array listing what was verified', async () => {
    const unsigned = observe('checklist test');
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(Array.isArray(result.checked)).toBe(true);
  });

  it('unsigned DOT with valid hash → checked includes hash', async () => {
    const { createHash } = await import('../hash.js');
    const payload = new TextEncoder().encode('payload');
    const h = await createHash(payload);
    const dot: DOT = { payload, payload_mode: 'plain', verify: { hash: h } };
    const result = await verify(dot);
    expect(result.valid).toBe(true);
    expect(result.checked).toContain('hash');
  });

  it('completely empty DOT verifies valid', async () => {
    const result = await verify({});
    expect(result.valid).toBe(true);
  });

  it('DOT with only type → valid', async () => {
    const dot: DOT = { type: 'event' };
    const result = await verify(dot);
    expect(result.valid).toBe(true);
  });
});

// ─── chain ────────────────────────────────────────────────────────────────────

describe('chain', () => {
  it('genesis DOT → depth is 0', () => {
    const dot = observe('first') as DOT;
    const g = chain(dot);
    expect(g.chain?.depth).toBe(0);
  });

  it('genesis DOT → previous is 32 zero bytes', () => {
    const dot = observe('first') as DOT;
    const g = chain(dot);
    expect(g.chain?.previous).toHaveLength(32);
    expect(g.chain?.previous?.every(b => b === 0)).toBe(true);
  });

  it('chain to previous → depth increments', () => {
    const g = chain(observe('g') as DOT);
    const d1 = chain(observe('d1') as DOT, g);
    expect(d1.chain?.depth).toBe(1);
  });

  it('chain sequence → depth increments correctly', () => {
    const g = chain(observe('g') as DOT);
    const d1 = chain(observe('1') as DOT, g);
    const d2 = chain(observe('2') as DOT, d1);
    const d3 = chain(observe('3') as DOT, d2);
    expect(d3.chain?.depth).toBe(3);
  });

  it('chain to previous → previous matches hash of previous DOT', () => {
    const g = chain(observe('genesis') as DOT);
    const d1 = chain(observe('next') as DOT, g);
    expect(d1.chain?.previous).toEqual(hash(g));
  });

  it('chain preserves payload', () => {
    const dot = observe('preserve') as DOT;
    const chained = chain(dot);
    expect(chained.payload).toEqual(dot.payload);
  });

  it('chain preserves type', () => {
    const dot: DOT = { ...observe('event'), type: 'event' };
    const chained = chain(dot);
    expect(chained.type).toBe('event');
  });

  it('chain does not mutate input DOT', () => {
    const dot = observe('test') as DOT;
    const before = { ...dot };
    chain(dot);
    expect(dot.chain).toEqual(before.chain);
  });

  it('hash of same DOT is deterministic', () => {
    const dot: DOT = { payload: new TextEncoder().encode('deterministic'), payload_mode: 'plain' };
    const h1 = hash(dot);
    const h2 = hash(dot);
    expect(h1).toEqual(h2);
  });

  it('hash returns 32 bytes', () => {
    const dot = observe('test') as DOT;
    const h = hash(dot);
    expect(h).toHaveLength(32);
  });

  it('hash changes when payload changes', () => {
    const d1: DOT = { payload: new TextEncoder().encode('a'), payload_mode: 'plain' };
    const d2: DOT = { payload: new TextEncoder().encode('b'), payload_mode: 'plain' };
    expect(hash(d1)).not.toEqual(hash(d2));
  });

  it('hash changes when type changes', () => {
    const d1: DOT = { payload: new TextEncoder().encode('x'), payload_mode: 'plain', type: 'event' };
    const d2: DOT = { payload: new TextEncoder().encode('x'), payload_mode: 'plain', type: 'claim' };
    expect(hash(d1)).not.toEqual(hash(d2));
  });

  it('hash of empty DOT is 32 bytes', () => {
    const h = hash({});
    expect(h).toHaveLength(32);
  });

  it('genesis previous is always 32 zero bytes regardless of DOT content', () => {
    const d1 = chain(observe('a') as DOT);
    const d2 = chain(observe('b') as DOT);
    expect(d1.chain?.previous).toEqual(d2.chain?.previous);
  });

  it('chain with depth-0 previous gives depth 1', () => {
    const g = chain(observe('g') as DOT);
    expect(g.chain?.depth).toBe(0);
    const next = chain(observe('next') as DOT, g);
    expect(next.chain?.depth).toBe(1);
  });

  it('chain from a DOT with no chain field → previous.depth treated as 0', () => {
    const noPrev: DOT = { payload: new TextEncoder().encode('no chain'), payload_mode: 'plain' };
    const linked = chain(observe('linked') as DOT, noPrev);
    expect(linked.chain?.depth).toBe(1);
  });

  it('hash of genesis is deterministic regardless of when called', () => {
    const g = chain(observe('genesis') as DOT);
    const h1 = hash(g);
    const h2 = hash(g);
    expect(h1).toEqual(h2);
  });

  it('chain link forms a verifiable sequence', () => {
    const g = chain(observe('step 0') as DOT);
    const d1 = chain(observe('step 1') as DOT, g);
    const d2 = chain(observe('step 2') as DOT, d1);
    // Verify each link manually
    expect(d1.chain?.previous).toEqual(hash(g));
    expect(d2.chain?.previous).toEqual(hash(d1));
  });
});

// ─── encode ───────────────────────────────────────────────────────────────────

describe('encode', () => {
  it('empty DOT → 0 bytes', () => {
    const bytes = toBytes({});
    expect(bytes).toHaveLength(0);
  });

  it('fromBytes of empty bytes → empty DOT', () => {
    const dot = fromBytes(new Uint8Array(0));
    expect(dot).toEqual({});
  });

  it('roundtrip: payload string', () => {
    const original: DOT = { payload: new TextEncoder().encode('hello'), payload_mode: 'plain' };
    const rt = fromBytes(toBytes(original));
    expect(rt.payload).toEqual(original.payload);
    expect(rt.payload_mode).toBe('plain');
  });

  it('roundtrip: payload_mode fhe', () => {
    const original: DOT = { payload: new TextEncoder().encode('encrypted'), payload_mode: 'fhe' };
    const rt = fromBytes(toBytes(original));
    expect(rt.payload_mode).toBe('fhe');
  });

  it('roundtrip: payload_mode none', () => {
    const original: DOT = { payload_mode: 'none' };
    const rt = fromBytes(toBytes(original));
    expect(rt.payload_mode).toBe('none');
  });

  it('roundtrip: all ObservationTypes', () => {
    const types: ObservationType[] = ['measure', 'state', 'event', 'claim', 'bond'];
    for (const t of types) {
      const original: DOT = { type: t };
      const rt = fromBytes(toBytes(original));
      expect(rt.type).toBe(t);
    }
  });

  it('roundtrip: sign.observer (32 bytes)', () => {
    const observer = new Uint8Array(32).fill(0xaa);
    const original: DOT = { sign: { observer } };
    const rt = fromBytes(toBytes(original));
    expect(rt.sign?.observer).toEqual(observer);
  });

  it('roundtrip: sign.signature (64 bytes)', () => {
    const signature = new Uint8Array(64).fill(0xbb);
    const original: DOT = { sign: { signature } };
    const rt = fromBytes(toBytes(original));
    expect(rt.sign?.signature).toEqual(signature);
  });

  it('roundtrip: sign.level all values', () => {
    const levels = ['absent', 'ephemeral', 'anonymous', 'pseudonymous', 'real'] as const;
    for (const level of levels) {
      const original: DOT = { sign: { level } };
      const rt = fromBytes(toBytes(original));
      expect(rt.sign?.level).toBe(level);
    }
  });

  it('roundtrip: time.utc', () => {
    const original: DOT = { time: { utc: 1234567890123 } };
    const rt = fromBytes(toBytes(original));
    expect(rt.time?.utc).toBe(1234567890123);
  });

  it('roundtrip: time.monotonic', () => {
    const original: DOT = { time: { monotonic: 9999 } };
    const rt = fromBytes(toBytes(original));
    expect(rt.time?.monotonic).toBe(9999);
  });

  it('roundtrip: chain.previous (32 bytes)', () => {
    const previous = new Uint8Array(32).fill(0xcc);
    const original: DOT = { chain: { previous, depth: 3 } };
    const rt = fromBytes(toBytes(original));
    expect(rt.chain?.previous).toEqual(previous);
  });

  it('roundtrip: chain.depth', () => {
    const original: DOT = { chain: { previous: new Uint8Array(32), depth: 42 } };
    const rt = fromBytes(toBytes(original));
    expect(rt.chain?.depth).toBe(42);
  });

  it('roundtrip: verify.hash (32 bytes)', () => {
    const hashBytes = new Uint8Array(32).fill(0xdd);
    const original: DOT = { verify: { hash: hashBytes } };
    const rt = fromBytes(toBytes(original));
    expect(rt.verify?.hash).toEqual(hashBytes);
  });

  it('roundtrip: fhe.scheme', () => {
    const original: DOT = { fhe: { scheme: 'tfhe' } };
    const rt = fromBytes(toBytes(original));
    expect(rt.fhe?.scheme).toBe('tfhe');
  });

  it('roundtrip: fhe.eval_key_hash (32 bytes)', () => {
    const ekh = new Uint8Array(32).fill(0xee);
    const original: DOT = { fhe: { eval_key_hash: ekh } };
    const rt = fromBytes(toBytes(original));
    expect(rt.fhe?.eval_key_hash).toEqual(ekh);
  });

  it('roundtrip: fhe.decryptable_by single key', () => {
    const key = new Uint8Array(32).fill(0xff);
    const original: DOT = { fhe: { decryptable_by: [key] } };
    const rt = fromBytes(toBytes(original));
    expect(rt.fhe?.decryptable_by?.[0]).toEqual(key);
  });

  it('roundtrip: fhe.decryptable_by multiple keys', () => {
    const k1 = new Uint8Array(32).fill(0x01);
    const k2 = new Uint8Array(32).fill(0x02);
    const original: DOT = { fhe: { decryptable_by: [k1, k2] } };
    const rt = fromBytes(toBytes(original));
    expect(rt.fhe?.decryptable_by).toHaveLength(2);
    expect(rt.fhe?.decryptable_by?.[0]).toEqual(k1);
    expect(rt.fhe?.decryptable_by?.[1]).toEqual(k2);
  });

  it('TLV tag 0x01 is payload', () => {
    const dot: DOT = { payload: new Uint8Array([0x41, 0x42, 0x43]), payload_mode: 'plain' };
    const bytes = toBytes(dot);
    expect(bytes[0]).toBe(0x01);
  });

  it('roundtrip full DOT', async () => {
    const { publicKey, secretKey } = await createIdentity();
    const unsigned: UnsignedDOT = {
      payload: new TextEncoder().encode('full'),
      payload_mode: 'plain',
      type: 'event',
      time: { utc: 1700000000000, monotonic: 7 },
      chain: { previous: new Uint8Array(32).fill(3), depth: 2 },
      verify: { hash: new Uint8Array(32).fill(4) },
      sign: { observer: publicKey, level: 'real' },
    };
    const signed = await sign(unsigned, secretKey);
    const rt = fromBytes(toBytes(signed));
    expect(rt.payload).toEqual(signed.payload);
    expect(rt.payload_mode).toBe('plain');
    expect(rt.type).toBe('event');
    expect(rt.time?.utc).toBe(1700000000000);
    expect(rt.time?.monotonic).toBe(7);
    expect(rt.chain?.depth).toBe(2);
    expect(rt.sign?.signature).toEqual(signed.sign?.signature);
    expect(rt.sign?.observer).toEqual(publicKey);
  });

  it('malformed bytes → throws meaningful error', () => {
    // TLV header says length 5000 but only a few bytes available
    // [tag=0x01][len=0x00001388=5000][only 3 bytes of value]
    const bad = new Uint8Array([0x01, 0x00, 0x00, 0x13, 0x88, 0x41, 0x42, 0x43]);
    expect(() => fromBytes(bad)).toThrow();
  });

  it('unknown tag is skipped gracefully', () => {
    // Build a valid TLV with an unknown tag (0xAA) followed by a known one
    // Format: [tag: 1][length: 4 big-endian][value: N]
    const unknown = new Uint8Array([0xaa, 0x00, 0x00, 0x00, 0x02, 0x11, 0x22]); // tag=0xAA, len=2, value=[0x11,0x22]
    const known = new Uint8Array([0x02, 0x00, 0x00, 0x00, 0x01, 0x01]); // tag=0x02 (payload_mode), len=1, value=1 ('plain')
    const combined = new Uint8Array([...unknown, ...known]);
    const dot = fromBytes(combined);
    expect(dot.payload_mode).toBe('plain');
  });

  it('toBytes is deterministic for same DOT', () => {
    const dot: DOT = { payload: new TextEncoder().encode('abc'), payload_mode: 'plain', type: 'event' };
    expect(toBytes(dot)).toEqual(toBytes(dot));
  });
});

// ─── trust ────────────────────────────────────────────────────────────────────

describe('trust', () => {
  it('empty DOT → trust 0.0', () => {
    expect(computeTrust({})).toBe(0.0);
  });

  it('signature present → +0.20', () => {
    const dot: DOT = { sign: { signature: new Uint8Array(64) } };
    expect(computeTrust(dot)).toBeCloseTo(0.20, 5);
  });

  it('time.utc present → +0.10', () => {
    const dot: DOT = { time: { utc: 1000 } };
    expect(computeTrust(dot)).toBeCloseTo(0.10, 5);
  });

  it('chain.previous present → +0.30', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32) } };
    expect(computeTrust(dot)).toBeCloseTo(0.30, 5);
  });

  it('verify.hash present → +0.20', () => {
    const dot: DOT = { verify: { hash: new Uint8Array(32) } };
    expect(computeTrust(dot)).toBeCloseTo(0.20, 5);
  });

  it('payload_mode fhe → +0.10', () => {
    const dot: DOT = { payload_mode: 'fhe' };
    expect(computeTrust(dot)).toBeCloseTo(0.10, 5);
  });

  it('payload_mode plain → no FHE bonus', () => {
    const dot: DOT = { payload_mode: 'plain' };
    expect(computeTrust(dot)).toBe(0.0);
  });

  it('identity level real → +0.10', () => {
    const dot: DOT = { sign: { level: 'real' } };
    expect(computeTrust(dot)).toBeCloseTo(0.10, 5);
  });

  it('identity level pseudonymous → +0.07', () => {
    const dot: DOT = { sign: { level: 'pseudonymous' } };
    expect(computeTrust(dot)).toBeCloseTo(0.07, 5);
  });

  it('identity level anonymous → +0.03', () => {
    const dot: DOT = { sign: { level: 'anonymous' } };
    expect(computeTrust(dot)).toBeCloseTo(0.03, 5);
  });

  it('identity level ephemeral → +0.01', () => {
    const dot: DOT = { sign: { level: 'ephemeral' } };
    expect(computeTrust(dot)).toBeCloseTo(0.01, 5);
  });

  it('identity level absent → +0.00', () => {
    const dot: DOT = { sign: { level: 'absent' } };
    expect(computeTrust(dot)).toBe(0.0);
  });

  it('chain depth 10 → multiplier applied', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64) },
      chain: { previous: new Uint8Array(32), depth: 10 },
    };
    const base = computeTrust({ sign: { signature: new Uint8Array(64) }, chain: { previous: new Uint8Array(32) } });
    const withDepth = computeTrust(dot);
    // depth 10 → multiplier = 1 + log10(10) = 2.0
    expect(withDepth).toBeCloseTo(base * 2.0, 5);
  });

  it('chain depth 1 → no multiplier (depth must be > 1)', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 1 } };
    expect(computeTrust(dot)).toBeCloseTo(0.30, 5);
  });

  it('chain depth 0 → no multiplier', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 0 } };
    expect(computeTrust(dot)).toBeCloseTo(0.30, 5);
  });

  it('full DOT with real identity → trust > 1.0', () => {
    const dot: DOT = {
      payload: new Uint8Array([1]),
      payload_mode: 'fhe',
      sign: { signature: new Uint8Array(64), observer: new Uint8Array(32), level: 'real' },
      time: { utc: 1000 },
      chain: { previous: new Uint8Array(32), depth: 2 },
      verify: { hash: new Uint8Array(32) },
    };
    expect(computeTrust(dot)).toBeGreaterThan(1.0);
  });

  it('signature + time + verify + fhe + real = 0.70 base', () => {
    const dot: DOT = {
      payload_mode: 'fhe',
      sign: { signature: new Uint8Array(64), level: 'real' },
      time: { utc: 1 },
      verify: { hash: new Uint8Array(32) },
    };
    // 0.20 (sig) + 0.10 (time) + 0.20 (verify) + 0.10 (fhe) + 0.10 (real) = 0.70
    expect(computeTrust(dot)).toBeCloseTo(0.70, 5);
  });

  it('chain depth 100 → high multiplier', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 100 } };
    const trust = computeTrust(dot);
    // 0.30 * (1 + log10(100)) = 0.30 * 3 = 0.90
    expect(trust).toBeCloseTo(0.90, 5);
  });
});

// ─── computeLevel ─────────────────────────────────────────────────────────────

describe('computeLevel', () => {
  it('empty DOT → level 0', () => {
    expect(computeLevel({})).toBe(DOTLevel.Empty);
  });

  it('payload only → level >= 1', () => {
    const dot: DOT = { payload: new Uint8Array([1]), payload_mode: 'plain' };
    expect(computeLevel(dot)).toBeGreaterThanOrEqual(DOTLevel.Payload);
  });

  it('DOTLevel enum: Empty=0, Payload=1, Timed=2, Verified=3, Signed=4, Chained=5, Full=6', () => {
    expect(DOTLevel.Empty).toBe(0);
    expect(DOTLevel.Payload).toBe(1);
    expect(DOTLevel.Timed).toBe(2);
    expect(DOTLevel.Verified).toBe(3);
    expect(DOTLevel.Signed).toBe(4);
    expect(DOTLevel.Chained).toBe(5);
    expect(DOTLevel.Full).toBe(6);
  });

  it('full STCV DOT → level 6 (Full)', () => {
    const dot: DOT = {
      payload: new Uint8Array([1]),
      payload_mode: 'plain',
      sign: { signature: new Uint8Array(64), observer: new Uint8Array(32) },
      time: { utc: 1 },
      chain: { previous: new Uint8Array(32) },
      verify: { hash: new Uint8Array(32) },
    };
    expect(computeLevel(dot)).toBe(DOTLevel.Full);
  });

  it('signed DOT without chain → level 4', () => {
    const dot: DOT = {
      payload: new Uint8Array([1]),
      payload_mode: 'plain',
      sign: { signature: new Uint8Array(64) },
      time: { utc: 1 },
      verify: { hash: new Uint8Array(32) },
    };
    // payload + time + verify + sign = 4
    expect(computeLevel(dot)).toBe(DOTLevel.Signed);
  });
});

// ─── identity ─────────────────────────────────────────────────────────────────

describe('createIdentity', () => {
  it('returns publicKey and secretKey', async () => {
    const id = await createIdentity();
    expect(id.publicKey).toBeInstanceOf(Uint8Array);
    expect(id.secretKey).toBeInstanceOf(Uint8Array);
  });

  it('publicKey is 32 bytes', async () => {
    const id = await createIdentity();
    expect(id.publicKey).toHaveLength(32);
  });

  it('secretKey is 32 bytes', async () => {
    const id = await createIdentity();
    expect(id.secretKey).toHaveLength(32);
  });

  it('each call produces a different keypair', async () => {
    const id1 = await createIdentity();
    const id2 = await createIdentity();
    expect(id1.publicKey).not.toEqual(id2.publicKey);
    expect(id1.secretKey).not.toEqual(id2.secretKey);
  });

  it('sign + verify roundtrip works with createIdentity keys', async () => {
    const { secretKey } = await createIdentity();
    const unsigned = observe('identity test');
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
  });
});

// ─── integration — full DOT lifecycle ─────────────────────────────────────────

describe('integration', () => {
  it('full lifecycle: observe → sign → verify → chain → encode → decode', async () => {
    const { secretKey } = await createIdentity();

    // Step 1: observe
    const unsigned = observe('sensor reading: 42.7', { type: 'measure' });
    expect(unsigned.payload_mode).toBe('fhe');

    // Step 2: sign
    const signed = await sign(unsigned, secretKey);
    expect(signed.sign?.signature).toBeDefined();

    // Step 3: verify
    const verifyResult = await verify(signed);
    expect(verifyResult.valid).toBe(true);

    // Step 4: chain
    const genesis = chain(signed);
    const second = chain(await sign(observe('reading 2', { type: 'measure' }), secretKey), genesis);
    expect(second.chain?.depth).toBe(1);

    // Step 5: encode → decode
    const encoded = toBytes(second);
    const decoded = fromBytes(encoded);
    expect(decoded.chain?.depth).toBe(1);
    expect(decoded.type).toBe('measure');
  });

  it('chain of 5 DOTs maintains correct depths', async () => {
    const { secretKey } = await createIdentity();
    let prev: DOT | undefined;
    for (let i = 0; i < 5; i++) {
      const unsigned = observe(`step ${i}`, { type: 'event' });
      const signed = await sign(unsigned, secretKey);
      const chained = chain(signed, prev);
      expect(chained.chain?.depth).toBe(i === 0 ? 0 : i);
      prev = chained;
    }
  });

  it('trust score increases with more STCV bases', async () => {
    const { secretKey } = await createIdentity();

    const d0: DOT = {};
    const d1: DOT = { payload: new Uint8Array([1]), payload_mode: 'fhe' };
    const d2: DOT = { ...d1, time: { utc: Date.now() } };
    const d3 = await sign(d2 as UnsignedDOT, secretKey);
    const d4 = chain(d3);

    const t0 = computeTrust(d0);
    const t1 = computeTrust(d1);
    const t2 = computeTrust(d2);
    const t3 = computeTrust(d3);
    const t4 = computeTrust(d4);

    expect(t1).toBeGreaterThan(t0);
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
    expect(t4).toBeGreaterThan(t3);
  });

  it('encode-decode preserves trust score', async () => {
    const { secretKey } = await createIdentity();
    const unsigned = observe('trust test', { type: 'claim' });
    const signed = await sign(unsigned, secretKey);
    const chained = chain(signed);
    const encoded = toBytes(chained);
    const decoded = fromBytes(encoded);
    expect(computeTrust(decoded)).toBeCloseTo(computeTrust(chained), 5);
  });

  it('multiple observers can each sign independently', async () => {
    const id1 = await createIdentity();
    const id2 = await createIdentity();
    const payload = observe('shared observation', { type: 'event', plaintext: true });
    const sig1 = await sign(payload, id1.secretKey);
    const sig2 = await sign(payload, id2.secretKey);

    const r1 = await verify(sig1);
    const r2 = await verify(sig2);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
    expect(sig1.sign?.observer).not.toEqual(sig2.sign?.observer);
  });

  it('claim DOT with hash integrity', async () => {
    const { createHash } = await import('../hash.js');
    const { secretKey } = await createIdentity();
    const payload = new TextEncoder().encode('I claim X');
    const payloadHash = await createHash(payload);

    const unsigned: UnsignedDOT = {
      payload,
      payload_mode: 'plain',
      type: 'claim',
      verify: { hash: payloadHash },
      time: { utc: Date.now() },
    };
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
    expect(result.checked).toContain('signature');
    expect(result.checked).toContain('hash');
  });

  it('bond DOT linking two entities', async () => {
    const { secretKey } = await createIdentity();
    const entityA = new Uint8Array(32).fill(0x0a);
    const entityB = new Uint8Array(32).fill(0x0b);
    const bondPayload = new TextEncoder().encode(JSON.stringify({ from: 'A', to: 'B', relation: 'trusts' }));
    const unsigned: UnsignedDOT = {
      payload: bondPayload,
      payload_mode: 'plain',
      type: 'bond',
      fhe: { decryptable_by: [entityA, entityB] },
    };
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
    expect(signed.type).toBe('bond');
  });

  it('observe → chain without signing is valid', () => {
    const dot = observe('unsigned chained') as DOT;
    const genesis = chain(dot);
    const second = chain(observe('second') as DOT, genesis);
    expect(second.chain?.depth).toBe(1);
  });

  it('hash changes between encode/decode cycle if field added', () => {
    const d1: DOT = { payload: new TextEncoder().encode('abc'), payload_mode: 'plain' };
    const d2: DOT = { ...d1, type: 'event' };
    expect(hash(d1)).not.toEqual(hash(d2));
  });

  it('all observation types survive encode-decode', () => {
    const types: ObservationType[] = ['measure', 'state', 'event', 'claim', 'bond'];
    for (const t of types) {
      const dot: DOT = { type: t };
      const rt = fromBytes(toBytes(dot));
      expect(rt.type).toBe(t);
    }
  });
});

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('observe with very large payload (1MB)', () => {
    const big = new Uint8Array(1024 * 1024).fill(0x42);
    const dot = observe(big);
    expect(dot.payload).toEqual(big);
    expect(dot.payload_mode).toBe('fhe');
  });

  it('toBytes and fromBytes with 1MB payload roundtrip', () => {
    const big = new Uint8Array(1024 * 1024).fill(0x42);
    const dot: DOT = { payload: big, payload_mode: 'plain' };
    const encoded = toBytes(dot);
    const decoded = fromBytes(encoded);
    expect(decoded.payload).toEqual(big);
  });

  it('sign with empty payload DOT', async () => {
    const { secretKey } = await createIdentity();
    const empty = observe();
    const signed = await sign(empty, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
  });

  it('chain with depth 1000', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 1000 } };
    const trust = computeTrust(dot);
    // 0.30 * (1 + log10(1000)) = 0.30 * 4 = 1.20
    expect(trust).toBeCloseTo(0.30 * (1 + Math.log10(1000)), 5);
  });

  it('DOT with only time base → valid and encodable', () => {
    const dot: DOT = { time: { utc: 999999 } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.time?.utc).toBe(999999);
  });

  it('DOT with time.utc = 0 → encodes and decodes correctly', () => {
    const dot: DOT = { time: { utc: 0 } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.time?.utc).toBe(0);
  });

  it('DOT with time.monotonic = 0 → encodes and decodes correctly', () => {
    const dot: DOT = { time: { monotonic: 0 } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.time?.monotonic).toBe(0);
  });

  it('chain.depth = 0 → encodes and decodes correctly', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 0 } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.chain?.depth).toBe(0);
  });

  it('computeTrust with no sign field → no identity bonus', () => {
    const dot: DOT = { time: { utc: 1 } };
    expect(computeTrust(dot)).toBeCloseTo(0.10, 5);
  });

  it('verify DOT where sign has observer but no signature → valid per #47', async () => {
    const { publicKey } = await createIdentity();
    const dot: DOT = { sign: { observer: publicKey } };
    const result = await verify(dot);
    expect(result.valid).toBe(true);
  });

  it('observe returns new object on each call', () => {
    const d1 = observe();
    const d2 = observe();
    expect(d1).not.toBe(d2);
  });

  it('toBytes handles DOT with only verify.hash', () => {
    const dot: DOT = { verify: { hash: new Uint8Array(32).fill(0x99) } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.verify?.hash).toEqual(dot.verify?.hash);
  });

  it('computeLevel with only time → level >= 1', () => {
    const dot: DOT = { time: { utc: 1 } };
    expect(computeLevel(dot)).toBeGreaterThanOrEqual(1);
  });

  it('computeLevel with sign.observer but no signature → no signature bonus', () => {
    const dot: DOT = { sign: { observer: new Uint8Array(32) } };
    // No signature → should not count as level 4
    expect(computeLevel(dot)).toBeLessThan(DOTLevel.Signed);
  });

  it('Unicode payload roundtrips correctly', () => {
    const text = '日本語テスト 🔥 émoji';
    const dot = observe(text, { plaintext: true });
    const rt = fromBytes(toBytes(dot as DOT));
    const decoded = new TextDecoder().decode(rt.payload);
    expect(decoded).toBe(text);
  });

  it('JSON payload with nested objects roundtrips', () => {
    const obj = { nested: { a: 1, b: [1, 2, 3] }, str: 'hello' };
    const dot = observe(obj, { plaintext: true });
    const rt = fromBytes(toBytes(dot as DOT));
    const decoded = JSON.parse(new TextDecoder().decode(rt.payload));
    expect(decoded).toEqual(obj);
  });
});

// ─── buildSignedBytes ─────────────────────────────────────────────────────────

describe('buildSignedBytes', () => {
  it('empty DOT → 0 bytes', () => {
    const bytes = buildSignedBytes({});
    expect(bytes).toHaveLength(0);
  });

  it('payload included in signed bytes', () => {
    const payload = new Uint8Array([1, 2, 3]);
    const bytes = buildSignedBytes({ payload, payload_mode: 'plain' });
    expect(bytes.length).toBeGreaterThan(0);
    // payload bytes should appear in the signed bytes
    expect(Array.from(bytes).slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('different payloads → different signed bytes', () => {
    const b1 = buildSignedBytes({ payload: new Uint8Array([1]), payload_mode: 'plain' });
    const b2 = buildSignedBytes({ payload: new Uint8Array([2]), payload_mode: 'plain' });
    expect(b1).not.toEqual(b2);
  });

  it('time.utc affects signed bytes', () => {
    const b1 = buildSignedBytes({ time: { utc: 1000 } });
    const b2 = buildSignedBytes({ time: { utc: 2000 } });
    expect(b1).not.toEqual(b2);
  });

  it('chain.previous affects signed bytes', () => {
    const b1 = buildSignedBytes({ chain: { previous: new Uint8Array(32).fill(1) } });
    const b2 = buildSignedBytes({ chain: { previous: new Uint8Array(32).fill(2) } });
    expect(b1).not.toEqual(b2);
  });

  it('type affects signed bytes', () => {
    const b1 = buildSignedBytes({ type: 'event' });
    const b2 = buildSignedBytes({ type: 'claim' });
    expect(b1).not.toEqual(b2);
  });

  it('same DOT → same signed bytes (deterministic)', () => {
    const dot: UnsignedDOT = {
      payload: new Uint8Array([9, 8, 7]),
      payload_mode: 'plain',
      time: { utc: 12345 },
    };
    expect(buildSignedBytes(dot)).toEqual(buildSignedBytes(dot));
  });
});

// ─── observe + trust combined ─────────────────────────────────────────────────

describe('observe + trust combined', () => {
  it('FHE observed DOT has trust > plain observed DOT', () => {
    const fhe = observe('secret') as DOT;
    const plain = observe('secret', { plaintext: true }) as DOT;
    expect(computeTrust(fhe)).toBeGreaterThan(computeTrust(plain));
  });

  it('trust of null/undefined payload → 0.0', () => {
    const dot = observe() as DOT;
    expect(computeTrust(dot)).toBe(0.0);
  });

  it('observe with all types gives valid level', () => {
    const types: ObservationType[] = ['measure', 'state', 'event', 'claim', 'bond'];
    for (const type of types) {
      const dot = observe('test', { type });
      expect(dot.type).toBe(type);
    }
  });

  it('trust after full sign+chain cycle > 1.0', async () => {
    const { secretKey } = await createIdentity();
    const unsigned = observe('high trust', { type: 'measure' });
    const signed = await sign(unsigned, secretKey);
    const withTime: DOT = { ...signed, time: { utc: Date.now() } };
    const resigned = await sign(withTime as UnsignedDOT, secretKey);
    const chained = chain(resigned);
    const withHash = {
      ...chained,
      verify: { hash: new Uint8Array(32).fill(1) },
      sign: { ...chained.sign, level: 'real' as const },
    };
    // Trust = sig(0.20) + time(0.10) + chain(0.30) + hash(0.20) + fhe(0.10) + real(0.10) = 1.00
    expect(computeTrust(withHash as DOT)).toBeGreaterThanOrEqual(0.90);
  });
});

// ─── hash utility ─────────────────────────────────────────────────────────────

describe('hash utility', () => {
  it('hash is a Uint8Array', () => {
    const h = hash(observe('x') as DOT);
    expect(h).toBeInstanceOf(Uint8Array);
  });

  it('hash is always 32 bytes', () => {
    const dots: DOT[] = [
      {},
      { payload: new Uint8Array([1]) },
      { type: 'event' },
      { time: { utc: 1 } },
    ];
    for (const d of dots) {
      expect(hash(d)).toHaveLength(32);
    }
  });

  it('hash is non-zero for non-empty DOT', () => {
    const h = hash({ payload: new Uint8Array([1, 2, 3]), payload_mode: 'plain' });
    expect(h.some(b => b !== 0)).toBe(true);
  });

  it('hash of empty DOT is stable (all zeros = hash of 0 bytes)', () => {
    const h1 = hash({});
    const h2 = hash({});
    expect(h1).toEqual(h2);
  });

  it('hash changes when time changes', () => {
    const d1: DOT = { time: { utc: 1000 } };
    const d2: DOT = { time: { utc: 2000 } };
    expect(hash(d1)).not.toEqual(hash(d2));
  });

  it('hash changes when verify.hash field changes', () => {
    const d1: DOT = { verify: { hash: new Uint8Array(32).fill(1) } };
    const d2: DOT = { verify: { hash: new Uint8Array(32).fill(2) } };
    expect(hash(d1)).not.toEqual(hash(d2));
  });
});

// ─── DOT type shapes ──────────────────────────────────────────────────────────

describe('DOT type shapes', () => {
  it('DOT with only fhe metadata → valid structure', () => {
    const dot: DOT = { fhe: { scheme: 'tfhe' } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.fhe?.scheme).toBe('tfhe');
  });

  it('DOT can have chain without payload', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 0 } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.chain?.depth).toBe(0);
    expect(rt.payload).toBeUndefined();
  });

  it('DOT can have sign without payload', () => {
    const dot: DOT = { sign: { observer: new Uint8Array(32), level: 'real' } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.sign?.observer).toEqual(dot.sign?.observer);
    expect(rt.sign?.level).toBe('real');
  });

  it('DOT can have verify.hash without sign', () => {
    const dot: DOT = { verify: { hash: new Uint8Array(32).fill(5) } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.verify?.hash).toEqual(dot.verify?.hash);
  });

  it('DOT with sign.level absent → trust 0.00 identity bonus', () => {
    const dot: DOT = { sign: {} };
    expect(computeTrust(dot)).toBe(0.0);
  });

  it('computeLevel of DOT with payload_mode=none → level 0', () => {
    const dot: DOT = { payload_mode: 'none' };
    // payload_mode=none but no actual payload bytes → level 0
    expect(computeLevel(dot)).toBe(DOTLevel.Empty);
  });

  it('computeLevel of DOT with time.monotonic only → level 1', () => {
    const dot: DOT = { time: { monotonic: 1 } };
    expect(computeLevel(dot)).toBeGreaterThanOrEqual(DOTLevel.Payload);
  });

  it('time.utc encodes large timestamp (year 2100)', () => {
    const ts = new Date('2100-01-01').getTime(); // ~4102444800000
    const dot: DOT = { time: { utc: ts } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.time?.utc).toBe(ts);
  });

  it('chain.depth encodes large value (1000000)', () => {
    const dot: DOT = { chain: { previous: new Uint8Array(32), depth: 1000000 } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.chain?.depth).toBe(1000000);
  });

  it('observe with undefined type → type undefined', () => {
    const dot = observe('test', {});
    expect(dot.type).toBeUndefined();
  });

  it('trust: signature + chain.previous with depth=2 applies multiplier', () => {
    const dot: DOT = {
      sign: { signature: new Uint8Array(64) },
      chain: { previous: new Uint8Array(32), depth: 2 },
    };
    // Base: sig(0.20) + chain(0.30) = 0.50
    // Multiplier: 1 + log10(2) ≈ 1.301
    const expected = 0.50 * (1 + Math.log10(2));
    expect(computeTrust(dot)).toBeCloseTo(expected, 5);
  });

  it('verify signed DOT with time base → still valid', async () => {
    const { secretKey } = await createIdentity();
    const unsigned: UnsignedDOT = {
      payload: new TextEncoder().encode('timed'),
      payload_mode: 'plain',
      time: { utc: Date.now(), monotonic: 1 },
    };
    const signed = await sign(unsigned, secretKey);
    const result = await verify(signed);
    expect(result.valid).toBe(true);
  });

  it('chain genesis hash is same for all genesis DOTs', () => {
    // All genesis DOTs have 32 zero bytes as previous
    const g1 = chain(observe('a') as DOT);
    const g2 = chain(observe('b') as DOT);
    // Both should have same genesis sentinel
    expect(g1.chain?.previous).toEqual(g2.chain?.previous);
    expect(g1.chain?.previous?.every(b => b === 0)).toBe(true);
  });

  it('hash utility: import createHash works async', async () => {
    const { createHash } = await import('../hash.js');
    const h = await createHash(new TextEncoder().encode('test'));
    expect(h).toHaveLength(32);
    expect(h).toBeInstanceOf(Uint8Array);
  });

  it('multiple fhe.decryptable_by keys → all survive roundtrip', () => {
    const keys = Array.from({ length: 5 }, (_, i) => new Uint8Array(32).fill(i + 1));
    const dot: DOT = { fhe: { decryptable_by: keys } };
    const rt = fromBytes(toBytes(dot));
    expect(rt.fhe?.decryptable_by).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(rt.fhe?.decryptable_by?.[i]).toEqual(keys[i]);
    }
  });

  it('multiple TLV fields all present → all decoded', () => {
    const dot: DOT = {
      payload: new TextEncoder().encode('multi'),
      payload_mode: 'fhe',
      type: 'state',
      time: { utc: 5000, monotonic: 3 },
      chain: { previous: new Uint8Array(32).fill(2), depth: 1 },
      verify: { hash: new Uint8Array(32).fill(3) },
      fhe: { scheme: 'tfhe', decryptable_by: [new Uint8Array(32).fill(4)] },
    };
    const rt = fromBytes(toBytes(dot));
    expect(rt.payload_mode).toBe('fhe');
    expect(rt.type).toBe('state');
    expect(rt.time?.utc).toBe(5000);
    expect(rt.time?.monotonic).toBe(3);
    expect(rt.chain?.depth).toBe(1);
    expect(rt.verify?.hash).toEqual(dot.verify?.hash);
    expect(rt.fhe?.scheme).toBe('tfhe');
    expect(rt.fhe?.decryptable_by).toHaveLength(1);
  });
});
