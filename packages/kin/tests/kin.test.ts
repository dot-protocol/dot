/**
 * kin.test.ts — Core Kin OS tests.
 *
 * Tests: identity creation, observation pipeline, stop enforcement,
 * incoming verification, state tracking, health DOT.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Kin } from '../src/kin.js';
import { createIdentity } from '@dot-protocol/core';

describe('Kin.create()', () => {
  it('generates a fresh identity when no config provided', async () => {
    const kin = await Kin.create();
    expect(kin.identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(kin.identity.publicKey.length).toBe(32);
    expect(kin.identity.secretKey).toBeInstanceOf(Uint8Array);
    expect(kin.identity.secretKey.length).toBe(32);
  });

  it('uses provided identity from config', async () => {
    const kp = await createIdentity();
    const kin = await Kin.create({ identity: kp });
    expect(kin.identity.publicKey).toEqual(kp.publicKey);
    expect(kin.identity.secretKey).toEqual(kp.secretKey);
  });

  it('generates different identities on each call', async () => {
    const k1 = await Kin.create();
    const k2 = await Kin.create();
    expect(k1.getPublicKeyHex()).not.toBe(k2.getPublicKeyHex());
  });

  it('initializes state with zero counts', async () => {
    const kin = await Kin.create();
    const state = kin.getState();
    expect(state.dotsCreated).toBe(0);
    expect(state.dotsVerified).toBe(0);
    expect(state.roomsVisited).toEqual([]);
  });

  it('sets privacyLevel from config', async () => {
    const kin = await Kin.create({ privacyLevel: 'maximum' });
    expect(kin.getState().privacyLevel).toBe('maximum');
  });

  it('defaults privacyLevel to balanced', async () => {
    const kin = await Kin.create();
    expect(kin.getState().privacyLevel).toBe('balanced');
  });

  it('sets stopConditions from config', async () => {
    const kin = await Kin.create({ stopConditions: { maxDailyDots: 10 } });
    expect(kin.getState().stopConditions.maxDailyDots).toBe(10);
  });

  it('initializes sessionStart as a recent timestamp', async () => {
    const before = Date.now();
    const kin = await Kin.create();
    const after = Date.now();
    expect(kin.getState().sessionStart).toBeGreaterThanOrEqual(before);
    expect(kin.getState().sessionStart).toBeLessThanOrEqual(after);
  });
});

describe('Kin.getIdentity()', () => {
  it('returns publicKey and shortcode', async () => {
    const kin = await Kin.create();
    const id = kin.getIdentity();
    expect(id.publicKey).toBeInstanceOf(Uint8Array);
    expect(typeof id.shortcode).toBe('string');
    expect(id.shortcode.length).toBe(8);
  });

  it('shortcode is first 8 chars of hex public key', async () => {
    const kin = await Kin.create();
    const id = kin.getIdentity();
    expect(kin.getPublicKeyHex().startsWith(id.shortcode)).toBe(true);
  });
});

describe('Kin.getPublicKeyHex()', () => {
  it('returns 64-char hex string', async () => {
    const kin = await Kin.create();
    const hex = kin.getPublicKeyHex();
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Kin.observe()', () => {
  it('creates a signed DOT from content', async () => {
    const kin = await Kin.create();
    const dot = await kin.observe('hello world');
    expect(dot).not.toBeNull();
    expect(dot!.sign?.signature).toBeInstanceOf(Uint8Array);
    expect(dot!.sign?.signature!.length).toBe(64);
  });

  it('DOT observer matches Kin public key', async () => {
    const kin = await Kin.create();
    const dot = await kin.observe('test');
    expect(dot!.sign?.observer).toEqual(kin.identity.publicKey);
  });

  it('increments dotsCreated after each observation', async () => {
    const kin = await Kin.create();
    await kin.observe('one');
    expect(kin.getState().dotsCreated).toBe(1);
    await kin.observe('two');
    expect(kin.getState().dotsCreated).toBe(2);
    await kin.observe('three');
    expect(kin.getState().dotsCreated).toBe(3);
  });

  it('tracks visited rooms', async () => {
    const kin = await Kin.create();
    await kin.observe('msg', 'chat.room');
    expect(kin.getState().roomsVisited).toContain('chat.room');
  });

  it('does not duplicate room in roomsVisited', async () => {
    const kin = await Kin.create();
    await kin.observe('a', 'chat.room');
    await kin.observe('b', 'chat.room');
    expect(kin.getState().roomsVisited.filter((r) => r === 'chat.room').length).toBe(1);
  });

  it('returns null when maxDailyDots stop condition triggers', async () => {
    const kin = await Kin.create({ stopConditions: { maxDailyDots: 2 } });
    await kin.observe('one');
    await kin.observe('two');
    const blocked = await kin.observe('three');
    expect(blocked).toBeNull();
  });

  it('returns null when room is blocked', async () => {
    const kin = await Kin.create({ stopConditions: { blockedRooms: ['bad.room'] } });
    const dot = await kin.observe('hello', 'bad.room');
    expect(dot).toBeNull();
  });

  it('allows observation into non-blocked rooms', async () => {
    const kin = await Kin.create({ stopConditions: { blockedRooms: ['bad.room'] } });
    const dot = await kin.observe('hello', 'good.room');
    expect(dot).not.toBeNull();
  });

  it('reformulates PII before creating DOT', async () => {
    const kin = await Kin.create({ privacyLevel: 'minimal' });
    const dot = await kin.observe('contact me at user@example.com');
    expect(dot).not.toBeNull();
    // The DOT payload should not contain the raw email
    const payloadText = new TextDecoder().decode(dot!.payload);
    expect(payloadText).not.toContain('user@example.com');
    expect(payloadText).toContain('[email]');
  });
});

describe('Kin.canObserve()', () => {
  it('returns true when no stop conditions set', async () => {
    const kin = await Kin.create();
    expect(kin.canObserve()).toBe(true);
  });

  it('returns false when maxDailyDots exhausted', async () => {
    const kin = await Kin.create({ stopConditions: { maxDailyDots: 1 } });
    await kin.observe('one');
    expect(kin.canObserve()).toBe(false);
  });

  it('returns false when room is blocked', async () => {
    const kin = await Kin.create({ stopConditions: { blockedRooms: ['bad.room'] } });
    expect(kin.canObserve('bad.room')).toBe(false);
  });

  it('returns true when room is not blocked', async () => {
    const kin = await Kin.create({ stopConditions: { blockedRooms: ['bad.room'] } });
    expect(kin.canObserve('good.room')).toBe(true);
  });
});

describe('Kin.verifyIncoming()', () => {
  it('validates a DOT signed by another Kin', async () => {
    const alice = await Kin.create();
    const dot = await alice.observe('hello');

    const bob = await Kin.create();
    const result = await bob.verifyIncoming(dot!);
    expect(result.valid).toBe(true);
  });

  it('returns trust score > 0 for signed DOT', async () => {
    const alice = await Kin.create();
    const dot = await alice.observe('hello');

    const bob = await Kin.create();
    const result = await bob.verifyIncoming(dot!);
    expect(result.trust).toBeGreaterThan(0);
  });

  it('flags low-depth DOT with warning', async () => {
    const alice = await Kin.create();
    const dot = await alice.observe('hello');

    const bob = await Kin.create();
    const result = await bob.verifyIncoming(dot!);
    // dot is depth 0 — should warn
    expect(result.warnings.some((w) => w.includes('zero chain depth'))).toBe(true);
  });

  it('increments dotsVerified on successful verify', async () => {
    const alice = await Kin.create();
    const dot = await alice.observe('hello');

    const bob = await Kin.create();
    await bob.verifyIncoming(dot!);
    expect(bob.getState().dotsVerified).toBe(1);
  });

  it('accepts unsigned DOT (valid per Correction #47) with warnings', async () => {
    const { observe: coreObserve } = await import('@dot-protocol/core');
    const unsigned = coreObserve('raw', { plaintext: true });

    const bob = await Kin.create();
    const result = await bob.verifyIncoming(unsigned as any);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('unsigned'))).toBe(true);
  });
});

describe('Kin.getState()', () => {
  it('returns a snapshot (not live reference)', async () => {
    const kin = await Kin.create();
    const snap1 = kin.getState();
    await kin.observe('x');
    const snap2 = kin.getState();
    expect(snap1.dotsCreated).toBe(0);
    expect(snap2.dotsCreated).toBe(1);
  });
});

describe('Kin.health()', () => {
  it('returns a DOT with type measure', async () => {
    const kin = await Kin.create();
    const h = kin.health();
    expect(h.type).toBe('measure');
  });

  it('health DOT payload contains dotsCreated', async () => {
    const kin = await Kin.create();
    await kin.observe('test');
    const h = kin.health();
    const text = new TextDecoder().decode(h.payload);
    const parsed = JSON.parse(text);
    expect(parsed.dotsCreated).toBe(1);
  });

  it('health DOT payload contains sessionDurationMs', async () => {
    const kin = await Kin.create();
    const h = kin.health();
    const text = new TextDecoder().decode(h.payload);
    const parsed = JSON.parse(text);
    expect(typeof parsed.sessionDurationMs).toBe('number');
    expect(parsed.sessionDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('health DOT payload contains shortcode', async () => {
    const kin = await Kin.create();
    const h = kin.health();
    const text = new TextDecoder().decode(h.payload);
    const parsed = JSON.parse(text);
    expect(parsed.shortcode).toBe(kin.getIdentity().shortcode);
  });
});

describe('Kin.shutdown()', () => {
  it('resets dotsCreated to 0', async () => {
    const kin = await Kin.create();
    await kin.observe('a');
    await kin.observe('b');
    kin.shutdown();
    expect(kin.getState().dotsCreated).toBe(0);
  });

  it('resets roomsVisited to empty', async () => {
    const kin = await Kin.create();
    await kin.observe('a', 'some.room');
    kin.shutdown();
    expect(kin.getState().roomsVisited).toEqual([]);
  });
});
