/**
 * media-state.test.ts — Mute and video state tests.
 * Target: 10+ tests covering toggleMute, toggleVideo, getMediaState.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import type { Identity } from '@dot-protocol/core';
import { startCall, joinCall } from '../src/session.js';
import { toggleMute, toggleVideo, getMediaState } from '../src/media-state.js';
import type { CallSession } from '../src/types.js';

// --- toggleMute ---

describe('toggleMute', () => {
  let caller: Identity;
  let participant: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    participant = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, participant);
    session = s2;
  });

  it('appends a DOT to the chain when muting', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await toggleMute(session, participant, true);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('appends a DOT to the chain when unmuting', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await toggleMute(session, participant, false);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns the signed mute DOT', async () => {
    const { dot } = await toggleMute(session, participant, true);
    expect(dot.sign?.signature).toBeDefined();
  });

  it('mute DOT has kind=mute', async () => {
    const { dot } = await toggleMute(session, participant, true);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('mute');
  });

  it('unmute DOT has kind=unmute', async () => {
    const { dot } = await toggleMute(session, participant, false);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('unmute');
  });
});

// --- toggleVideo ---

describe('toggleVideo', () => {
  let caller: Identity;
  let participant: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    participant = await createIdentity();
    const s = await startCall(caller, 'video');
    const { session: s2 } = await joinCall(s, participant);
    session = s2;
  });

  it('appends a DOT to the chain when turning video off', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await toggleVideo(session, participant, true);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns the signed video-off DOT', async () => {
    const { dot } = await toggleVideo(session, participant, true);
    expect(dot.sign?.signature).toBeDefined();
  });

  it('video-off DOT has kind=video-off', async () => {
    const { dot } = await toggleVideo(session, participant, true);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('video-off');
  });

  it('video-on DOT has kind=video-on', async () => {
    const { dot } = await toggleVideo(session, participant, false);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('video-on');
  });
});

// --- getMediaState ---

describe('getMediaState', () => {
  let caller: Identity;
  let participant: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    participant = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, participant);
    session = s2;
  });

  it('returns muted=false and videoOff=false by default (no events)', () => {
    const state = getMediaState(session, participant.publicKey);
    expect(state.muted).toBe(false);
    expect(state.videoOff).toBe(false);
  });

  it('reflects mute after toggleMute(true)', async () => {
    const { session: updated } = await toggleMute(session, participant, true);
    const state = getMediaState(updated, participant.publicKey);
    expect(state.muted).toBe(true);
  });

  it('reflects unmuted after toggleMute(false)', async () => {
    const { session: s2 } = await toggleMute(session, participant, true);
    const { session: s3 } = await toggleMute(s2, participant, false);
    const state = getMediaState(s3, participant.publicKey);
    expect(state.muted).toBe(false);
  });

  it('reflects videoOff after toggleVideo(true)', async () => {
    const { session: updated } = await toggleVideo(session, participant, true);
    const state = getMediaState(updated, participant.publicKey);
    expect(state.videoOff).toBe(true);
  });

  it('multiple toggles — latest wins', async () => {
    const { session: s2 } = await toggleMute(session, participant, true);
    const { session: s3 } = await toggleMute(s2, participant, false);
    const { session: s4 } = await toggleMute(s3, participant, true);
    const state = getMediaState(s4, participant.publicKey);
    expect(state.muted).toBe(true);
  });

  it('does not affect other participants', async () => {
    const other = await createIdentity();
    const { session: s2 } = await joinCall(session, other);
    const { session: s3 } = await toggleMute(s2, participant, true);
    const otherState = getMediaState(s3, other.publicKey);
    expect(otherState.muted).toBe(false);
  });
});
