/**
 * channel.test.ts — SecureChannel encrypt/decrypt
 * 28 tests
 */

import { describe, it, expect } from 'vitest';
import { SecureChannel, createSecureChannel } from '../src/channel.js';
import { observe, toBytes } from '@dot-protocol/core';

function makeSessionKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// ─── Construction ─────────────────────────────────────────────────────────────

describe('SecureChannel construction', () => {
  it('creates channel from 32-byte key', () => {
    const ch = new SecureChannel(makeSessionKey());
    expect(ch).toBeDefined();
    expect(ch.closed).toBe(false);
  });

  it('throws if key is not 32 bytes', () => {
    expect(() => new SecureChannel(new Uint8Array(16))).toThrow('32 bytes');
    expect(() => new SecureChannel(new Uint8Array(64))).toThrow('32 bytes');
  });

  it('createSecureChannel() is equivalent to new SecureChannel()', () => {
    const key = makeSessionKey();
    const ch = createSecureChannel(key);
    expect(ch).toBeInstanceOf(SecureChannel);
    expect(ch.closed).toBe(false);
  });

  it('initial messageCount is 0', () => {
    const ch = new SecureChannel(makeSessionKey());
    expect(ch.messageCount).toBe(0);
  });

  it('initial keyRotations is 0', () => {
    const ch = new SecureChannel(makeSessionKey());
    expect(ch.keyRotations).toBe(0);
  });
});

// ─── Encrypt / Decrypt roundtrip ─────────────────────────────────────────────

describe('encrypt/decrypt', () => {
  it('roundtrip: encrypt then decrypt returns original bytes', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = new TextEncoder().encode('hello DOT-SEAL');
    const ciphertext = await ch.encrypt(plaintext);
    const recovered = await ch.decrypt(ciphertext);
    expect(Buffer.from(recovered).toString()).toBe('hello DOT-SEAL');
  });

  it('roundtrip with empty bytes', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = new Uint8Array(0);
    const ciphertext = await ch.encrypt(plaintext);
    const recovered = await ch.decrypt(ciphertext);
    expect(recovered.length).toBe(0);
  });

  it('ciphertext is longer than plaintext (nonce + MAC overhead)', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = new TextEncoder().encode('test');
    const ciphertext = await ch.encrypt(plaintext);
    // nonce (24) + MAC (16) + plaintext
    expect(ciphertext.length).toBe(24 + 16 + plaintext.length);
  });

  it('tampered ciphertext is rejected', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = new TextEncoder().encode('sensitive data');
    const ciphertext = await ch.encrypt(plaintext);
    // Flip a byte in the message body (after nonce)
    ciphertext[30] ^= 0xff;
    await expect(ch.decrypt(ciphertext)).rejects.toThrow();
  });

  it('tampered nonce causes decryption failure', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = new TextEncoder().encode('test');
    const ciphertext = await ch.encrypt(plaintext);
    // Flip a byte in the nonce
    ciphertext[0] ^= 0x01;
    await expect(ch.decrypt(ciphertext)).rejects.toThrow();
  });

  it('ciphertext from different key cannot be decrypted', async () => {
    const ch1 = new SecureChannel(makeSessionKey());
    const ch2 = new SecureChannel(makeSessionKey());
    const plaintext = new TextEncoder().encode('secret');
    const ciphertext = await ch1.encrypt(plaintext);
    await expect(ch2.decrypt(ciphertext)).rejects.toThrow();
  });

  it('ciphertext too short throws', async () => {
    const ch = new SecureChannel(makeSessionKey());
    await expect(ch.decrypt(new Uint8Array(10))).rejects.toThrow('too short');
  });

  it('large payload encrypts and decrypts correctly', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = crypto.getRandomValues(new Uint8Array(64_000));
    const ciphertext = await ch.encrypt(plaintext);
    const recovered = await ch.decrypt(ciphertext);
    expect(Buffer.from(recovered).toString('hex')).toBe(
      Buffer.from(plaintext).toString('hex'),
    );
  });

  it('consecutive encryptions produce different ciphertexts (nonce advances)', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const plaintext = new TextEncoder().encode('same message');
    const ct1 = await ch.encrypt(plaintext);
    const ct2 = await ch.encrypt(plaintext);
    expect(Buffer.from(ct1).toString('hex')).not.toBe(
      Buffer.from(ct2).toString('hex'),
    );
  });
});

// ─── send / receive (DOT level) ───────────────────────────────────────────────

describe('send/receive', () => {
  it('send/receive roundtrip returns equivalent DOT', async () => {
    const key = makeSessionKey();
    const sender = new SecureChannel(key);
    const receiver = new SecureChannel(key);

    const dot = observe('hello', { type: 'measure', plaintext: true });
    const encrypted = await sender.send(dot);
    const recovered = await receiver.receive(encrypted);

    expect(recovered.type).toBe('measure');
  });

  it('send returns EncryptedDOT with ciphertext and seq', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const dot = observe('test', { type: 'event', plaintext: true });
    const enc = await ch.send(dot);
    expect(enc.ciphertext).toBeInstanceOf(Uint8Array);
    expect(enc.ciphertext.length).toBeGreaterThan(0);
    expect(typeof enc.seq).toBe('number');
  });

  it('seq starts at 0', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const dot = observe('first', { type: 'event', plaintext: true });
    const enc = await ch.send(dot);
    expect(enc.seq).toBe(0);
  });
});

// ─── Key rotation ─────────────────────────────────────────────────────────────

describe('key rotation', () => {
  it('rotateKey increments keyRotations', async () => {
    const ch = new SecureChannel(makeSessionKey());
    expect(ch.keyRotations).toBe(0);
    await ch.rotateKey();
    expect(ch.keyRotations).toBe(1);
    await ch.rotateKey();
    expect(ch.keyRotations).toBe(2);
  });

  it('after rotation, new encrypt/decrypt still works', async () => {
    const key = makeSessionKey();
    const sender = new SecureChannel(key);
    const receiver = new SecureChannel(key);

    // Rotate both to same state
    await sender.rotateKey();
    await receiver.rotateKey();

    const plaintext = new TextEncoder().encode('post-rotation');
    const ct = await sender.encrypt(plaintext);
    const recovered = await receiver.decrypt(ct);
    expect(Buffer.from(recovered).toString()).toBe('post-rotation');
  });

  it('pre-rotation ciphertext cannot be decrypted post-rotation', async () => {
    const key = makeSessionKey();
    const sender = new SecureChannel(key);
    const receiver = new SecureChannel(key);

    const plaintext = new TextEncoder().encode('pre-rotation');
    const ct = await sender.encrypt(plaintext);

    // Rotate receiver but not sender — different key epochs
    await receiver.rotateKey();

    await expect(receiver.decrypt(ct)).rejects.toThrow();
  });
});

// ─── Close ────────────────────────────────────────────────────────────────────

describe('close', () => {
  it('closed channel rejects encrypt', async () => {
    const ch = new SecureChannel(makeSessionKey());
    ch.close();
    await expect(ch.encrypt(new Uint8Array(4))).rejects.toThrow('closed');
  });

  it('closed channel rejects decrypt', async () => {
    const ch = new SecureChannel(makeSessionKey());
    ch.close();
    await expect(ch.decrypt(new Uint8Array(40))).rejects.toThrow('closed');
  });

  it('closed channel rejects send', async () => {
    const ch = new SecureChannel(makeSessionKey());
    ch.close();
    await expect(ch.send(observe('test'))).rejects.toThrow('closed');
  });

  it('closed is true after close()', () => {
    const ch = new SecureChannel(makeSessionKey());
    expect(ch.closed).toBe(false);
    ch.close();
    expect(ch.closed).toBe(true);
  });

  it('closed channel rejects rotateKey', async () => {
    const ch = new SecureChannel(makeSessionKey());
    ch.close();
    await expect(ch.rotateKey()).rejects.toThrow('closed');
  });
});

// ─── Message count tracking ───────────────────────────────────────────────────

describe('messageCount tracking', () => {
  it('messageCount increments after each encrypt call', async () => {
    const ch = new SecureChannel(makeSessionKey());
    expect(ch.messageCount).toBe(0);
    await ch.encrypt(new TextEncoder().encode('a'));
    expect(ch.messageCount).toBe(1);
    await ch.encrypt(new TextEncoder().encode('b'));
    expect(ch.messageCount).toBe(2);
  });

  it('messageCount increments after decrypt call', async () => {
    const key = makeSessionKey();
    const sender = new SecureChannel(key);
    const receiver = new SecureChannel(key);
    const ct = await sender.encrypt(new TextEncoder().encode('test'));
    expect(receiver.messageCount).toBe(0);
    await receiver.decrypt(ct);
    expect(receiver.messageCount).toBe(1);
  });

  it('multiple rotations accumulate correctly', async () => {
    const ch = new SecureChannel(makeSessionKey());
    await ch.rotateKey();
    await ch.rotateKey();
    await ch.rotateKey();
    expect(ch.keyRotations).toBe(3);
  });

  it('send seq increments monotonically', async () => {
    const ch = new SecureChannel(makeSessionKey());
    const d = observe('test', { type: 'event', plaintext: true });
    const e1 = await ch.send(d);
    const e2 = await ch.send(d);
    const e3 = await ch.send(d);
    expect(e1.seq).toBe(0);
    expect(e2.seq).toBe(1);
    expect(e3.seq).toBe(2);
  });
});
