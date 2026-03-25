/**
 * session.test.ts — Call session management tests.
 * Target: 20+ tests covering startCall, joinCall, leaveCall, endCall, getCallState.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import type { Identity } from '@dot-protocol/core';
import { walk } from '@dot-protocol/chain';
import {
  startCall,
  joinCall,
  leaveCall,
  endCall,
  getCallState,
} from '../src/session.js';
import type { CallSession } from '../src/types.js';

// --- Helpers ---

function pubkeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

function decodeFirstPayload(session: CallSession): Record<string, unknown> | null {
  const dots = walk(session.chain);
  if (dots.length === 0) return null;
  const dot = dots[0];
  if (!dot.payload) return null;
  return JSON.parse(new TextDecoder().decode(dot.payload));
}

// --- startCall ---

describe('startCall', () => {
  let identity: Identity;

  beforeEach(async () => {
    identity = await createIdentity();
  });

  it('creates a session in initiating state', async () => {
    const session = await startCall(identity, 'voice');
    expect(session.state).toBe('initiating');
  });

  it('sets the call type to voice', async () => {
    const session = await startCall(identity, 'voice');
    expect(session.type).toBe('voice');
  });

  it('sets the call type to video', async () => {
    const session = await startCall(identity, 'video');
    expect(session.type).toBe('video');
  });

  it('creates a unique session id', async () => {
    const s1 = await startCall(identity, 'voice');
    const s2 = await startCall(identity, 'voice');
    expect(s1.id).not.toBe(s2.id);
  });

  it('starts with an empty participants map', async () => {
    const session = await startCall(identity, 'voice');
    expect(session.participants.size).toBe(0);
  });

  it('has no startedAt initially', async () => {
    const session = await startCall(identity, 'voice');
    expect(session.startedAt).toBeUndefined();
  });

  it('appends a genesis call-start DOT to the chain', async () => {
    const session = await startCall(identity, 'voice');
    expect(session.chain.appendCount).toBe(1);
  });

  it('the genesis DOT has kind call-start in payload', async () => {
    const session = await startCall(identity, 'voice');
    const payload = decodeFirstPayload(session);
    expect(payload).not.toBeNull();
    expect(payload?.kind).toBe('call-start');
  });

  it('the genesis DOT is signed by the caller', async () => {
    const session = await startCall(identity, 'voice');
    const dots = walk(session.chain);
    expect(dots[0].sign?.observer).toBeDefined();
    expect(Buffer.from(dots[0].sign!.observer!).toString('hex')).toBe(
      pubkeyHex(identity.publicKey),
    );
  });
});

// --- joinCall ---

describe('joinCall', () => {
  let caller: Identity;
  let joiner: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    joiner = await createIdentity();
    session = await startCall(caller, 'voice');
  });

  it('transitions state from initiating to active', async () => {
    const { session: updated } = await joinCall(session, joiner);
    expect(updated.state).toBe('active');
  });

  it('adds the participant to the map', async () => {
    const { session: updated } = await joinCall(session, joiner);
    expect(updated.participants.size).toBe(1);
  });

  it('records the joined participant with correct pubkey', async () => {
    const { participant } = await joinCall(session, joiner);
    expect(Buffer.from(participant.publicKey).toString('hex')).toBe(
      pubkeyHex(joiner.publicKey),
    );
  });

  it('sets participant muted=false and videoOff=false by default', async () => {
    const { participant } = await joinCall(session, joiner);
    expect(participant.muted).toBe(false);
    expect(participant.videoOff).toBe(false);
  });

  it('stores optional name on the participant', async () => {
    const { participant } = await joinCall(session, joiner, 'Alice');
    expect(participant.name).toBe('Alice');
  });

  it('sets startedAt when first participant joins', async () => {
    const before = Date.now();
    const { session: updated } = await joinCall(session, joiner);
    const after = Date.now();
    expect(updated.startedAt).toBeGreaterThanOrEqual(before);
    expect(updated.startedAt).toBeLessThanOrEqual(after);
  });

  it('appends a call-join DOT to the chain', async () => {
    const { session: updated } = await joinCall(session, joiner);
    expect(updated.chain.appendCount).toBe(2); // call-start + call-join
  });

  it('tracks multiple joins — both participants in map', async () => {
    const third = await createIdentity();
    const { session: s2 } = await joinCall(session, joiner);
    const { session: s3 } = await joinCall(s2, third);
    expect(s3.participants.size).toBe(2);
  });

  it('throws if joining an ended call', async () => {
    const { session: ended } = await joinCall(session, joiner);
    const terminated = await endCall(ended, caller);
    await expect(joinCall(terminated, joiner)).rejects.toThrow();
  });

  it('participant has a joinedAt timestamp', async () => {
    const before = Date.now();
    const { participant } = await joinCall(session, joiner);
    expect(participant.joinedAt).toBeGreaterThanOrEqual(before);
  });
});

// --- leaveCall ---

describe('leaveCall', () => {
  let caller: Identity;
  let joiner: Identity;
  let active: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    joiner = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session } = await joinCall(s, joiner);
    active = session;
  });

  it('marks the participant as left', async () => {
    const updated = await leaveCall(active, joiner);
    const p = updated.participants.get(pubkeyHex(joiner.publicKey));
    expect(p?.leftAt).toBeDefined();
  });

  it('sets leftAt to a recent timestamp', async () => {
    const before = Date.now();
    const updated = await leaveCall(active, joiner);
    const after = Date.now();
    const p = updated.participants.get(pubkeyHex(joiner.publicKey));
    expect(p!.leftAt).toBeGreaterThanOrEqual(before);
    expect(p!.leftAt).toBeLessThanOrEqual(after);
  });

  it('appends a call-leave DOT to the chain', async () => {
    const updated = await leaveCall(active, joiner);
    // chain: call-start(1) + call-join(2) + call-leave(3)
    expect(updated.chain.appendCount).toBe(3);
  });

  it('does not change state to ended when one participant leaves', async () => {
    const updated = await leaveCall(active, joiner);
    expect(updated.state).toBe('active');
  });

  it('throws if leaving an already-ended call', async () => {
    const ended = await endCall(active, caller);
    await expect(leaveCall(ended, joiner)).rejects.toThrow();
  });
});

// --- endCall ---

describe('endCall', () => {
  let caller: Identity;
  let joiner: Identity;
  let active: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    joiner = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session } = await joinCall(s, joiner);
    active = session;
  });

  it('transitions state to ended', async () => {
    const ended = await endCall(active, caller);
    expect(ended.state).toBe('ended');
  });

  it('sets endedAt', async () => {
    const before = Date.now();
    const ended = await endCall(active, caller);
    const after = Date.now();
    expect(ended.endedAt).toBeGreaterThanOrEqual(before);
    expect(ended.endedAt).toBeLessThanOrEqual(after);
  });

  it('marks all remaining participants as left', async () => {
    const ended = await endCall(active, caller);
    for (const p of ended.participants.values()) {
      expect(p.leftAt).toBeDefined();
    }
  });

  it('appends a call-end DOT to the chain', async () => {
    const ended = await endCall(active, caller);
    // call-start(1) + call-join(2) + call-end(3)
    expect(ended.chain.appendCount).toBe(3);
  });

  it('throws if ending an already-ended call', async () => {
    const ended = await endCall(active, caller);
    await expect(endCall(ended, caller)).rejects.toThrow();
  });
});

// --- getCallState ---

describe('getCallState', () => {
  let caller: Identity;
  let joiner: Identity;

  beforeEach(async () => {
    caller = await createIdentity();
    joiner = await createIdentity();
  });

  it('returns initiating state for a new session', async () => {
    const session = await startCall(caller, 'voice');
    const { state } = getCallState(session);
    expect(state).toBe('initiating');
  });

  it('returns 0 duration before anyone joins', async () => {
    const session = await startCall(caller, 'voice');
    const { duration } = getCallState(session);
    expect(duration).toBe(0);
  });

  it('returns active state and positive duration after join', async () => {
    const s = await startCall(caller, 'voice');
    const { session } = await joinCall(s, joiner);
    const { state, duration } = getCallState(session);
    expect(state).toBe('active');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('lists all participants', async () => {
    const s = await startCall(caller, 'voice');
    const third = await createIdentity();
    const { session: s2 } = await joinCall(s, joiner);
    const { session: s3 } = await joinCall(s2, third);
    const { participants } = getCallState(s3);
    expect(participants.length).toBe(2);
  });

  it('returns ended state after endCall', async () => {
    const s = await startCall(caller, 'voice');
    const { session } = await joinCall(s, joiner);
    const ended = await endCall(session, caller);
    const { state } = getCallState(ended);
    expect(state).toBe('ended');
  });
});
