/**
 * x25519.test.ts — X25519 key exchange utilities
 * 12 tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateEphemeralKeypair,
  computeSharedSecret,
  deriveSessionKey,
} from '../src/x25519.js';

describe('generateEphemeralKeypair', () => {
  it('returns 32-byte public key', async () => {
    const kp = await generateEphemeralKeypair();
    expect(kp.publicKey).toBeInstanceOf(Uint8Array);
    expect(kp.publicKey.length).toBe(32);
  });

  it('returns 32-byte secret key', async () => {
    const kp = await generateEphemeralKeypair();
    expect(kp.secretKey).toBeInstanceOf(Uint8Array);
    expect(kp.secretKey.length).toBe(32);
  });

  it('generates unique keypairs each call', async () => {
    const kp1 = await generateEphemeralKeypair();
    const kp2 = await generateEphemeralKeypair();
    expect(Buffer.from(kp1.publicKey).toString('hex')).not.toBe(
      Buffer.from(kp2.publicKey).toString('hex'),
    );
  });

  it('public and secret keys are different', async () => {
    const kp = await generateEphemeralKeypair();
    expect(Buffer.from(kp.publicKey).toString('hex')).not.toBe(
      Buffer.from(kp.secretKey).toString('hex'),
    );
  });
});

describe('computeSharedSecret', () => {
  it('produces 32-byte shared secret', async () => {
    const alice = await generateEphemeralKeypair();
    const bob = await generateEphemeralKeypair();
    const secret = await computeSharedSecret(alice.secretKey, bob.publicKey);
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret.length).toBe(32);
  });

  it('DH agreement: alice(bob.pub) === bob(alice.pub)', async () => {
    const alice = await generateEphemeralKeypair();
    const bob = await generateEphemeralKeypair();
    const aliceShared = await computeSharedSecret(alice.secretKey, bob.publicKey);
    const bobShared = await computeSharedSecret(bob.secretKey, alice.publicKey);
    expect(Buffer.from(aliceShared).toString('hex')).toBe(
      Buffer.from(bobShared).toString('hex'),
    );
  });

  it('different keypairs produce different shared secrets', async () => {
    const alice = await generateEphemeralKeypair();
    const bob = await generateEphemeralKeypair();
    const carol = await generateEphemeralKeypair();
    const secret1 = await computeSharedSecret(alice.secretKey, bob.publicKey);
    const secret2 = await computeSharedSecret(alice.secretKey, carol.publicKey);
    expect(Buffer.from(secret1).toString('hex')).not.toBe(
      Buffer.from(secret2).toString('hex'),
    );
  });

  it('throws if secret key is not 32 bytes', async () => {
    const bob = await generateEphemeralKeypair();
    await expect(
      computeSharedSecret(new Uint8Array(64), bob.publicKey),
    ).rejects.toThrow('32 bytes');
  });

  it('throws if public key is not 32 bytes', async () => {
    const alice = await generateEphemeralKeypair();
    await expect(
      computeSharedSecret(alice.secretKey, new Uint8Array(64)),
    ).rejects.toThrow('32 bytes');
  });
});

describe('deriveSessionKey', () => {
  it('produces 32-byte session key', async () => {
    const kp1 = await generateEphemeralKeypair();
    const kp2 = await generateEphemeralKeypair();
    const shared = await computeSharedSecret(kp1.secretKey, kp2.publicKey);
    const key = await deriveSessionKey(shared, 'dot-seal');
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('derivation is deterministic', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const key1 = await deriveSessionKey(sharedSecret, 'dot-seal');
    const key2 = await deriveSessionKey(sharedSecret, 'dot-seal');
    expect(Buffer.from(key1).toString('hex')).toBe(
      Buffer.from(key2).toString('hex'),
    );
  });

  it('different contexts produce different keys', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const key1 = await deriveSessionKey(sharedSecret, 'context1');
    const key2 = await deriveSessionKey(sharedSecret, 'context2');
    expect(Buffer.from(key1).toString('hex')).not.toBe(
      Buffer.from(key2).toString('hex'),
    );
  });

  it('throws if shared secret is not 32 bytes', async () => {
    await expect(
      deriveSessionKey(new Uint8Array(16), 'dot-seal'),
    ).rejects.toThrow('32 bytes');
  });

  it('context longer than 8 chars is truncated, still works', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const key = await deriveSessionKey(sharedSecret, 'this-is-a-very-long-context-string');
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('context shorter than 8 chars is padded, still deterministic', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const k1 = await deriveSessionKey(sharedSecret, 'abc');
    const k2 = await deriveSessionKey(sharedSecret, 'abc');
    expect(Buffer.from(k1).toString('hex')).toBe(Buffer.from(k2).toString('hex'));
  });
});
