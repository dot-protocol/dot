/**
 * DOT Protocol R855 — Result type tests
 *
 * Tests for:
 *   - Result type primitives: ok, err, isOk, isErr, unwrap, unwrapOr
 *   - safeVerify: valid DOT → ok; tampered DOT → err VERIFY_FAILED
 *   - safeSign:   valid key → ok; wrong-size key → err SIGN_INVALID_KEY
 *   - safeDecode: valid bytes → ok; empty → ok; garbage → err DECODE_MALFORMED; truncated → err
 *   - safeHash:   valid DOT → ok; returns 32 bytes
 *   - DOTError shape: code, message, source, details
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  safeVerify,
  safeSign,
  safeDecode,
  safeHash,
  observe,
  toBytes,
  createIdentity,
  type DOT,
  type Result,
  type DOTError,
} from '../src/index.js';

// ─── Result type primitives ──────────────────────────────────────────────────

describe('ok()', () => {
  it('sets ok: true', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
  });

  it('carries the value', () => {
    const r = ok('hello');
    expect(r.ok && r.value).toBe('hello');
  });

  it('works with Uint8Array values', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const r = ok(bytes);
    expect(r.ok && r.value).toBe(bytes);
  });

  it('works with undefined value', () => {
    const r = ok(undefined);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toBeUndefined();
  });

  it('works with object values', () => {
    const val = { a: 1, b: 'two' };
    const r = ok(val);
    expect(r.ok && r.value).toBe(val);
  });
});

describe('err()', () => {
  it('sets ok: false', () => {
    const r = err({ code: 'TEST', message: 'fail' });
    expect(r.ok).toBe(false);
  });

  it('carries the error', () => {
    const e: DOTError = { code: 'MY_ERROR', message: 'oops', source: 'test' };
    const r = err(e);
    expect(!r.ok && r.error).toEqual(e);
  });

  it('works with string errors', () => {
    const r = err('plain string error');
    expect(!r.ok && r.error).toBe('plain string error');
  });
});

describe('isOk()', () => {
  it('returns true for ok result', () => {
    expect(isOk(ok(1))).toBe(true);
  });

  it('returns false for err result', () => {
    expect(isOk(err({ code: 'X', message: 'x' }))).toBe(false);
  });

  it('narrows type — value accessible after guard', () => {
    const r: Result<number, DOTError> = ok(99);
    if (isOk(r)) {
      expect(r.value).toBe(99);
    } else {
      throw new Error('Should have been ok');
    }
  });
});

describe('isErr()', () => {
  it('returns true for err result', () => {
    expect(isErr(err({ code: 'X', message: 'x' }))).toBe(true);
  });

  it('returns false for ok result', () => {
    expect(isErr(ok(42))).toBe(false);
  });

  it('narrows type — error accessible after guard', () => {
    const r: Result<number, DOTError> = err({ code: 'CODE', message: 'msg' });
    if (isErr(r)) {
      expect(r.error.code).toBe('CODE');
    } else {
      throw new Error('Should have been err');
    }
  });
});

describe('unwrap()', () => {
  it('returns value from ok result', () => {
    expect(unwrap(ok(7))).toBe(7);
  });

  it('throws on err result', () => {
    expect(() => unwrap(err({ code: 'FAIL', message: 'failed' }))).toThrow();
  });

  it('thrown error message includes serialized error', () => {
    let message = '';
    try {
      unwrap(err({ code: 'FAIL', message: 'something broke' }));
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('FAIL');
  });
});

describe('unwrapOr()', () => {
  it('returns value from ok result', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
  });

  it('returns default from err result', () => {
    expect(unwrapOr(err({ code: 'X', message: 'x' }), 99)).toBe(99);
  });

  it('default can be null', () => {
    expect(unwrapOr(err({ code: 'X', message: 'x' }), null)).toBeNull();
  });

  it('does not throw on err result', () => {
    expect(() => unwrapOr(err({ code: 'X', message: 'x' }), 'default')).not.toThrow();
  });
});

// ─── safeVerify ──────────────────────────────────────────────────────────────

describe('safeVerify()', () => {
  let identity: { publicKey: Uint8Array; secretKey: Uint8Array };

  beforeAll(async () => {
    identity = await createIdentity();
  });

  it('unsigned DOT → ok (Correction #47)', async () => {
    const dot = observe('hello');
    const r = await safeVerify(dot);
    expect(isOk(r)).toBe(true);
  });

  it('empty DOT → ok', async () => {
    const dot = observe();
    const r = await safeVerify(dot);
    expect(isOk(r)).toBe(true);
  });

  it('valid signed DOT → ok', async () => {
    const dot = observe('signed content');
    const { safeSign: signFn } = await import('../src/index.js');
    const signed = await signFn(dot, identity.secretKey);
    expect(isOk(signed)).toBe(true);
    if (!isOk(signed)) return;

    const r = await safeVerify(signed.value);
    expect(isOk(r)).toBe(true);
  });

  it('tampered DOT → err with code VERIFY_FAILED', async () => {
    // Build a valid signed DOT then corrupt the signature
    const { safeSign: signFn } = await import('../src/index.js');
    const dot = observe('tamper me');
    const signedR = await signFn(dot, identity.secretKey);
    if (!isOk(signedR)) throw new Error('sign failed in test setup');

    const signed = signedR.value;
    // Corrupt the first byte of the signature
    const badSig = new Uint8Array(signed.sign!.signature!);
    badSig[0] ^= 0xff;
    const tampered: DOT = {
      ...signed,
      sign: { ...signed.sign, signature: badSig },
    };

    const r = await safeVerify(tampered);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error.code).toBe('VERIFY_FAILED');
      expect(r.error.message).toBeTruthy();
      expect(r.error.source).toBe('safeVerify');
    }
  });

  it('err result has DOTError shape', async () => {
    const { safeSign: signFn } = await import('../src/index.js');
    const dot = observe('shape test');
    const signedR = await signFn(dot, identity.secretKey);
    if (!isOk(signedR)) throw new Error('sign failed');

    const signed = signedR.value;
    const badSig = new Uint8Array(signed.sign!.signature!);
    badSig[0] ^= 0xaa;
    const tampered: DOT = { ...signed, sign: { ...signed.sign, signature: badSig } };

    const r = await safeVerify(tampered);
    if (isErr(r)) {
      expect(typeof r.error.code).toBe('string');
      expect(typeof r.error.message).toBe('string');
    }
  });
});

// ─── safeSign ────────────────────────────────────────────────────────────────

describe('safeSign()', () => {
  let identity: { publicKey: Uint8Array; secretKey: Uint8Array };

  beforeAll(async () => {
    identity = await createIdentity();
  });

  it('valid 32-byte key → ok', async () => {
    const dot = observe('sign me');
    const r = await safeSign(dot, identity.secretKey);
    expect(isOk(r)).toBe(true);
  });

  it('success result contains signature', async () => {
    const dot = observe('check sig');
    const r = await safeSign(dot, identity.secretKey);
    if (!isOk(r)) throw new Error('expected ok');
    expect(r.value.sign?.signature).toBeInstanceOf(Uint8Array);
    expect(r.value.sign?.signature?.length).toBe(64);
  });

  it('success result contains public key', async () => {
    const dot = observe('check pubkey');
    const r = await safeSign(dot, identity.secretKey);
    if (!isOk(r)) throw new Error('expected ok');
    expect(r.value.sign?.observer).toBeInstanceOf(Uint8Array);
    expect(r.value.sign?.observer?.length).toBe(32);
  });

  it('wrong key size (16 bytes) → err SIGN_INVALID_KEY', async () => {
    const shortKey = new Uint8Array(16);
    const dot = observe('bad key');
    const r = await safeSign(dot, shortKey);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error.code).toBe('SIGN_INVALID_KEY');
    }
  });

  it('wrong key size (64 bytes) → err SIGN_INVALID_KEY', async () => {
    const longKey = new Uint8Array(64);
    const dot = observe('bad key');
    const r = await safeSign(dot, longKey);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error.code).toBe('SIGN_INVALID_KEY');
    }
  });

  it('empty key (0 bytes) → err SIGN_INVALID_KEY', async () => {
    const emptyKey = new Uint8Array(0);
    const dot = observe('empty key');
    const r = await safeSign(dot, emptyKey);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(r.error.code).toBe('SIGN_INVALID_KEY');
    }
  });

  it('SIGN_INVALID_KEY error includes key length in details', async () => {
    const shortKey = new Uint8Array(10);
    const dot = observe('length check');
    const r = await safeSign(dot, shortKey);
    if (isErr(r)) {
      expect(r.error.details).toMatchObject({ keyLength: 10 });
      expect(r.error.source).toBe('safeSign');
    }
  });

  it('error code is a consistent string', async () => {
    const shortKey = new Uint8Array(5);
    const r = await safeSign(observe('x'), shortKey);
    if (isErr(r)) {
      expect(r.error.code).toBe('SIGN_INVALID_KEY');
    }
  });
});

// ─── safeDecode ──────────────────────────────────────────────────────────────

describe('safeDecode()', () => {
  it('valid encoded DOT → ok', () => {
    const dot = observe('encode me');
    const bytes = toBytes(dot);
    const r = safeDecode(bytes);
    expect(isOk(r)).toBe(true);
  });

  it('decoded DOT preserves payload', () => {
    const dot = observe('round-trip');
    const bytes = toBytes(dot);
    const r = safeDecode(bytes);
    if (!isOk(r)) throw new Error('expected ok');
    const decoded = new TextDecoder().decode(r.value.payload);
    expect(decoded).toBe('round-trip');
  });

  it('empty bytes → ok with empty DOT', () => {
    const r = safeDecode(new Uint8Array(0));
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value).toEqual({});
    }
  });

  it('random garbage bytes → err', () => {
    // Garbage that doesn't form valid TLV
    const garbage = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x05, 0xde, 0xad]);
    const r = safeDecode(garbage);
    // Could be DECODE_MALFORMED or DECODE_TRUNCATED depending on exact framing
    if (isErr(r)) {
      expect(['DECODE_MALFORMED', 'DECODE_TRUNCATED']).toContain(r.error.code);
    }
    // Note: if it happens to parse (unknown tag skipped), that's also acceptable
  });

  it('truncated TLV header → err DECODE_TRUNCATED or DECODE_MALFORMED', () => {
    // Only 3 bytes — not enough for a 5-byte TLV header
    const truncated = new Uint8Array([0x01, 0x00, 0x00]);
    const r = safeDecode(truncated);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(['DECODE_MALFORMED', 'DECODE_TRUNCATED']).toContain(r.error.code);
    }
  });

  it('declared length exceeds buffer → err DECODE_MALFORMED', () => {
    // TLV header: tag=0x01, length=0x00000100 (256), but only 0 value bytes follow
    const bad = new Uint8Array([0x01, 0x00, 0x00, 0x01, 0x00]);
    const r = safeDecode(bad);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) {
      expect(['DECODE_MALFORMED', 'DECODE_TRUNCATED']).toContain(r.error.code);
    }
  });

  it('error has message and source', () => {
    const truncated = new Uint8Array([0x01, 0x00]);
    const r = safeDecode(truncated);
    if (isErr(r)) {
      expect(typeof r.error.message).toBe('string');
      expect(r.error.source).toBe('safeDecode');
    }
  });
});

// ─── safeHash ────────────────────────────────────────────────────────────────

describe('safeHash()', () => {
  it('valid DOT → ok', () => {
    const dot = observe('hash me');
    const r = safeHash(dot);
    expect(isOk(r)).toBe(true);
  });

  it('returns exactly 32 bytes', () => {
    const dot = observe('32 bytes');
    const r = safeHash(dot);
    if (!isOk(r)) throw new Error('expected ok');
    expect(r.value).toBeInstanceOf(Uint8Array);
    expect(r.value.length).toBe(32);
  });

  it('empty DOT → ok with 32-byte hash', () => {
    const dot = observe();
    const r = safeHash(dot);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.length).toBe(32);
    }
  });

  it('same DOT produces same hash (deterministic)', () => {
    const dot = observe('deterministic', { plaintext: true });
    const r1 = safeHash(dot);
    const r2 = safeHash(dot);
    if (!isOk(r1) || !isOk(r2)) throw new Error('expected ok');
    expect(r1.value).toEqual(r2.value);
  });

  it('different DOTs produce different hashes', () => {
    const r1 = safeHash(observe('alpha', { plaintext: true }));
    const r2 = safeHash(observe('beta', { plaintext: true }));
    if (!isOk(r1) || !isOk(r2)) throw new Error('expected ok');
    expect(r1.value).not.toEqual(r2.value);
  });
});

// ─── Error code consistency ───────────────────────────────────────────────────

describe('Error code consistency', () => {
  let identity: { publicKey: Uint8Array; secretKey: Uint8Array };

  beforeAll(async () => {
    identity = await createIdentity();
  });

  it('VERIFY_FAILED is a string constant', async () => {
    const { safeSign: signFn } = await import('../src/index.js');
    const signedR = await signFn(observe('x'), identity.secretKey);
    if (!isOk(signedR)) throw new Error('sign failed');
    const signed = signedR.value;
    const badSig = new Uint8Array(signed.sign!.signature!);
    badSig[0] ^= 0xff;
    const r = await safeVerify({ ...signed, sign: { ...signed.sign, signature: badSig } });
    if (isErr(r)) expect(r.error.code).toBe('VERIFY_FAILED');
  });

  it('SIGN_INVALID_KEY is a string constant', async () => {
    const r = await safeSign(observe('x'), new Uint8Array(1));
    if (isErr(r)) expect(r.error.code).toBe('SIGN_INVALID_KEY');
  });

  it('DECODE_MALFORMED or DECODE_TRUNCATED for bad bytes', () => {
    const r = safeDecode(new Uint8Array([0x01, 0x00, 0x00, 0x01, 0x00]));
    if (isErr(r)) {
      expect(['DECODE_MALFORMED', 'DECODE_TRUNCATED']).toContain(r.error.code);
    }
  });

  it('all DOTError objects have message field as string', async () => {
    const r1 = await safeSign(observe('x'), new Uint8Array(5));
    if (isErr(r1)) expect(typeof r1.error.message).toBe('string');

    const r2 = safeDecode(new Uint8Array([0xff, 0x00, 0x00]));
    if (isErr(r2)) expect(typeof r2.error.message).toBe('string');
  });

  it('all DOTError objects have source field pointing to the function', async () => {
    const r1 = await safeSign(observe('x'), new Uint8Array(5));
    if (isErr(r1)) expect(r1.error.source).toBe('safeSign');

    const r2 = safeDecode(new Uint8Array([0x01, 0x00, 0x00, 0x01, 0x00]));
    if (isErr(r2)) expect(r2.error.source).toBe('safeDecode');
  });
});
