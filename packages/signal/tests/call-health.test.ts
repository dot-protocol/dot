/**
 * call-health.test.ts — Call quality metrics tests.
 * Target: 5+ tests covering reportQuality and getCallHealth.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import type { Identity } from '@dot-protocol/core';
import { startCall, joinCall } from '../src/session.js';
import { reportQuality, getCallHealth } from '../src/call-health.js';
import type { CallSession, QualityMetrics } from '../src/types.js';

const GOOD_METRICS: QualityMetrics = {
  rttMs: 45,
  packetLossPercent: 0.5,
  bitrateKbps: 128,
  audioLevel: 0.7,
};

const POOR_METRICS: QualityMetrics = {
  rttMs: 350,
  packetLossPercent: 12.5,
  bitrateKbps: 24,
  audioLevel: 0.1,
};

// --- reportQuality ---

describe('reportQuality', () => {
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

  it('appends a DOT to the chain', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await reportQuality(session, participant, GOOD_METRICS);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns a signed quality DOT', async () => {
    const { dot } = await reportQuality(session, participant, GOOD_METRICS);
    expect(dot.sign?.signature).toBeDefined();
  });

  it('quality DOT is a measure observation type', async () => {
    const { dot } = await reportQuality(session, participant, GOOD_METRICS);
    expect(dot.type).toBe('measure');
  });

  it('quality DOT payload contains rttMs', async () => {
    const { dot } = await reportQuality(session, participant, GOOD_METRICS);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.data.rttMs).toBe(45);
  });

  it('multiple quality reports accumulate in chain', async () => {
    const { session: s2 } = await reportQuality(session, participant, GOOD_METRICS);
    const { session: s3 } = await reportQuality(s2, participant, POOR_METRICS);
    expect(s3.chain.appendCount).toBe(session.chain.appendCount + 2);
  });
});

// --- getCallHealth ---

describe('getCallHealth', () => {
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

  it('returns zero averages when no reports exist', () => {
    const health = getCallHealth(session);
    expect(health.avgRtt).toBe(0);
    expect(health.avgLoss).toBe(0);
  });

  it('returns single report values directly', async () => {
    const { session: updated } = await reportQuality(session, participant, GOOD_METRICS);
    const health = getCallHealth(updated);
    expect(health.avgRtt).toBe(45);
    expect(health.avgLoss).toBe(0.5);
  });

  it('averages multiple reports', async () => {
    const { session: s2 } = await reportQuality(session, participant, GOOD_METRICS);
    const { session: s3 } = await reportQuality(s2, participant, POOR_METRICS);
    const health = getCallHealth(s3);
    // avg RTT: (45 + 350) / 2 = 197.5
    expect(health.avgRtt).toBe((45 + 350) / 2);
    // avg loss: (0.5 + 12.5) / 2 = 6.5
    expect(health.avgLoss).toBe((0.5 + 12.5) / 2);
  });

  it('reports participantCount correctly', () => {
    const health = getCallHealth(session);
    expect(health.participantCount).toBe(1); // only participant joined (caller started but didn't join)
  });

  it('reports zero duration before call starts', async () => {
    const s = await startCall(caller, 'voice');
    const health = getCallHealth(s);
    expect(health.duration).toBe(0);
  });
});
