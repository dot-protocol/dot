/**
 * session.test.ts — DOT-SEAL session as a DOT chain
 * 18 tests
 */

import { describe, it, expect } from 'vitest';
import { createSession } from '../src/session.js';
import { SecureChannel } from '../src/channel.js';

function makeChannel(): SecureChannel {
  return new SecureChannel(crypto.getRandomValues(new Uint8Array(32)));
}

function makeIdentity(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

// ─── createSession ─────────────────────────────────────────────────────────

describe('createSession', () => {
  it('returns a session with a start DOT', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(session.startDOT).toBeDefined();
    expect(session.startDOT.type).toBe('event');
  });

  it('start DOT has chain base (genesis)', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(session.startDOT.chain).toBeDefined();
    expect(session.startDOT.chain?.depth).toBe(0);
  });

  it('start DOT has time base', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(session.startDOT.time?.utc).toBeGreaterThan(0);
  });

  it('start DOT sign observer matches identity', () => {
    const identity = makeIdentity();
    const session = createSession(makeChannel(), identity);
    expect(Buffer.from(session.startDOT.sign!.observer!).toString('hex')).toBe(
      Buffer.from(identity).toString('hex'),
    );
  });

  it('session has unique id', () => {
    const s1 = createSession(makeChannel(), makeIdentity());
    const s2 = createSession(makeChannel(), makeIdentity());
    expect(s1.id).not.toBe(s2.id);
  });

  it('initial messageCount is 0', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(session.messageCount).toBe(0);
  });

  it('session is active initially', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(session.active).toBe(true);
  });
});

// ─── recordMessage ────────────────────────────────────────────────────────

describe('session.recordMessage', () => {
  it('recordMessage increments messageCount', () => {
    const session = createSession(makeChannel(), makeIdentity());
    session.recordMessage('sent');
    expect(session.messageCount).toBe(1);
    session.recordMessage('received');
    expect(session.messageCount).toBe(2);
  });

  it('message DOT has measure type', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const dot = session.recordMessage('sent');
    expect(dot.type).toBe('measure');
  });

  it('message DOT has chain base (linked to previous)', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const dot = session.recordMessage('sent');
    expect(dot.chain).toBeDefined();
    expect((dot.chain?.depth ?? 0)).toBeGreaterThan(0);
  });

  it('message DOT has time base', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const dot = session.recordMessage('received');
    expect(dot.time?.utc).toBeGreaterThan(0);
  });

  it('updates lastActivity on recordMessage', async () => {
    const session = createSession(makeChannel(), makeIdentity());
    const before = session.lastActivity;
    // Small delay to ensure time advances
    await new Promise((r) => setTimeout(r, 2));
    session.recordMessage('sent');
    expect(session.lastActivity).toBeGreaterThanOrEqual(before);
  });
});

// ─── sessionHealth ────────────────────────────────────────────────────────

describe('session.sessionHealth', () => {
  it('returns a measure DOT', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const health = session.sessionHealth();
    expect(health.type).toBe('measure');
  });

  it('health DOT has time base', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const health = session.sessionHealth();
    expect(health.time?.utc).toBeGreaterThan(0);
  });

  it('health DOT payload is plaintext with messageCount', () => {
    const session = createSession(makeChannel(), makeIdentity());
    session.recordMessage('sent');
    const health = session.sessionHealth();
    // Payload should contain session-health data
    expect(health.payload_mode).toBe('plain');
    const text = new TextDecoder().decode(health.payload);
    const data = JSON.parse(text);
    expect(data.messageCount).toBe(1);
  });
});

// ─── session chain integrity ──────────────────────────────────────────────

describe('session chain integrity', () => {
  it('each recordMessage produces a chained DOT at increasing depth', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const d1 = session.recordMessage('sent');
    const d2 = session.recordMessage('received');
    const d3 = session.recordMessage('sent');
    // Each successive DOT should have a higher chain depth
    expect((d2.chain?.depth ?? 0)).toBeGreaterThan((d1.chain?.depth ?? 0));
    expect((d3.chain?.depth ?? 0)).toBeGreaterThan((d2.chain?.depth ?? 0));
  });

  it('start DOT is a genesis DOT (chain.previous = 32 zero bytes)', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const prev = session.startDOT.chain?.previous;
    expect(prev).toBeDefined();
    expect(prev!.every((b) => b === 0)).toBe(true);
  });

  it('session id is a non-empty hex string', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(typeof session.id).toBe('string');
    expect(session.id.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(session.id)).toBe(true);
  });

  it('keyRotations reflects channel rotations', async () => {
    const ch = makeChannel();
    const session = createSession(ch, makeIdentity());
    expect(session.keyRotations).toBe(0);
    await ch.rotateKey();
    expect(session.keyRotations).toBe(1);
  });

  it('startedAt is close to Date.now()', () => {
    const before = Date.now();
    const session = createSession(makeChannel(), makeIdentity());
    const after = Date.now();
    expect(session.startedAt).toBeGreaterThanOrEqual(before);
    expect(session.startedAt).toBeLessThanOrEqual(after);
  });
});

// ─── session close ────────────────────────────────────────────────────────

describe('session close', () => {
  it('close() sets active to false', () => {
    const session = createSession(makeChannel(), makeIdentity());
    expect(session.active).toBe(true);
    session.close();
    expect(session.active).toBe(false);
  });

  it('close() returns an event DOT', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const closeDot = session.close();
    expect(closeDot.type).toBe('event');
  });

  it('close DOT has chain linkage', () => {
    const session = createSession(makeChannel(), makeIdentity());
    const closeDot = session.close();
    expect(closeDot.chain).toBeDefined();
  });

  it('close DOT payload contains messageCount and durationMs', () => {
    const session = createSession(makeChannel(), makeIdentity());
    session.recordMessage('sent');
    const closeDot = session.close();
    const text = new TextDecoder().decode(closeDot.payload);
    const data = JSON.parse(text);
    expect(data.messageCount).toBe(1);
    expect(data.durationMs).toBeGreaterThanOrEqual(0);
  });
});
