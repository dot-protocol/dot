/**
 * signaling.test.ts — SDP and ICE exchange tests.
 * Target: 20+ tests covering sendOffer, sendAnswer, sendICECandidate,
 * getOffersForPeer, getAnswersForPeer, getICECandidatesForPeer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import type { Identity } from '@dot-protocol/core';
import { walk } from '@dot-protocol/chain';
import { startCall, joinCall } from '../src/session.js';
import {
  sendOffer,
  sendAnswer,
  sendICECandidate,
  getOffersForPeer,
  getAnswersForPeer,
  getICECandidatesForPeer,
} from '../src/signaling.js';
import type { CallSession } from '../src/types.js';

// --- Helpers ---

function pubkeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

const FAKE_SDP_OFFER = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=type:offer\r\n';
const FAKE_SDP_ANSWER = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=type:answer\r\n';
const FAKE_ICE = 'candidate:0 1 UDP 2130706431 192.168.1.1 12345 typ host';

// --- sendOffer ---

describe('sendOffer', () => {
  let caller: Identity;
  let callee: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    callee = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, callee);
    session = s2;
  });

  it('appends a DOT to the chain', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns the signed offer DOT', async () => {
    const { dot } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    expect(dot.sign?.signature).toBeDefined();
    expect(dot.sign?.observer).toBeDefined();
  });

  it('the offer DOT is signed by the caller', async () => {
    const { dot } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    expect(Buffer.from(dot.sign!.observer!).toString('hex')).toBe(pubkeyHex(caller.publicKey));
  });

  it('the offer payload contains the SDP string', async () => {
    const { dot } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.data.sdp).toBe(FAKE_SDP_OFFER);
  });

  it('the offer payload has kind sdp-offer', async () => {
    const { dot } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('sdp-offer');
  });

  it('the offer payload has the correct targetPeer', async () => {
    const target = pubkeyHex(callee.publicKey);
    const { dot } = await sendOffer(session, FAKE_SDP_OFFER, target, caller);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.data.targetPeer).toBe(target);
  });
});

// --- sendAnswer ---

describe('sendAnswer', () => {
  let caller: Identity;
  let callee: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    callee = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, callee);
    session = s2;
  });

  it('appends a DOT to the chain', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await sendAnswer(session, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('returns the signed answer DOT', async () => {
    const { dot } = await sendAnswer(session, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);
    expect(dot.sign?.signature).toBeDefined();
  });

  it('the answer payload has kind sdp-answer', async () => {
    const { dot } = await sendAnswer(session, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('sdp-answer');
  });

  it('the answer payload contains the SDP string', async () => {
    const { dot } = await sendAnswer(session, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.data.sdp).toBe(FAKE_SDP_ANSWER);
  });
});

// --- sendICECandidate ---

describe('sendICECandidate', () => {
  let caller: Identity;
  let callee: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    callee = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, callee);
    session = s2;
  });

  it('appends a DOT to the chain', async () => {
    const countBefore = session.chain.appendCount;
    const { session: updated } = await sendICECandidate(session, FAKE_ICE, 0, pubkeyHex(callee.publicKey), caller);
    expect(updated.chain.appendCount).toBe(countBefore + 1);
  });

  it('the ICE DOT has kind ice-candidate', async () => {
    const { dot } = await sendICECandidate(session, FAKE_ICE, 0, pubkeyHex(callee.publicKey), caller);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.kind).toBe('ice-candidate');
  });

  it('the ICE payload contains the candidate string', async () => {
    const { dot } = await sendICECandidate(session, FAKE_ICE, 0, pubkeyHex(callee.publicKey), caller);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.data.candidate).toBe(FAKE_ICE);
  });

  it('records the correct sdpMLineIndex', async () => {
    const { dot } = await sendICECandidate(session, FAKE_ICE, 2, pubkeyHex(callee.publicKey), caller);
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload!));
    expect(parsed.data.sdpMLineIndex).toBe(2);
  });
});

// --- getOffersForPeer ---

describe('getOffersForPeer', () => {
  let caller: Identity;
  let callee: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    callee = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, callee);
    session = s2;
  });

  it('returns empty array when no offers sent', () => {
    const offers = getOffersForPeer(session, pubkeyHex(callee.publicKey));
    expect(offers).toHaveLength(0);
  });

  it('returns the offer after sendOffer', async () => {
    const { session: updated } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const offers = getOffersForPeer(updated, pubkeyHex(callee.publicKey));
    expect(offers).toHaveLength(1);
    expect(offers[0].sdp).toBe(FAKE_SDP_OFFER);
  });

  it('returns only offers for the specified peer', async () => {
    const third = await createIdentity();
    const { session: s2 } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const { session: s3 } = await sendOffer(s2, FAKE_SDP_OFFER, pubkeyHex(third.publicKey), caller);

    const forCallee = getOffersForPeer(s3, pubkeyHex(callee.publicKey));
    const forThird = getOffersForPeer(s3, pubkeyHex(third.publicKey));

    expect(forCallee).toHaveLength(1);
    expect(forThird).toHaveLength(1);
  });

  it('returns multiple offers for the same peer', async () => {
    const { session: s2 } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const { session: s3 } = await sendOffer(s2, FAKE_SDP_OFFER + '2', pubkeyHex(callee.publicKey), caller);
    const offers = getOffersForPeer(s3, pubkeyHex(callee.publicKey));
    expect(offers).toHaveLength(2);
  });

  it('offer type is always "offer"', async () => {
    const { session: updated } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const offers = getOffersForPeer(updated, pubkeyHex(callee.publicKey));
    expect(offers[0].type).toBe('offer');
  });
});

// --- getAnswersForPeer ---

describe('getAnswersForPeer', () => {
  let caller: Identity;
  let callee: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    callee = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, callee);
    session = s2;
  });

  it('returns empty array when no answers sent', () => {
    const answers = getAnswersForPeer(session, pubkeyHex(caller.publicKey));
    expect(answers).toHaveLength(0);
  });

  it('returns the answer after sendAnswer', async () => {
    const { session: updated } = await sendAnswer(session, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);
    const answers = getAnswersForPeer(updated, pubkeyHex(caller.publicKey));
    expect(answers).toHaveLength(1);
    expect(answers[0].sdp).toBe(FAKE_SDP_ANSWER);
  });

  it('offer → answer flow: chain contains both', async () => {
    const { session: s2 } = await sendOffer(session, FAKE_SDP_OFFER, pubkeyHex(callee.publicKey), caller);
    const { session: s3 } = await sendAnswer(s2, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);

    const offers = getOffersForPeer(s3, pubkeyHex(callee.publicKey));
    const answers = getAnswersForPeer(s3, pubkeyHex(caller.publicKey));

    expect(offers).toHaveLength(1);
    expect(answers).toHaveLength(1);
  });

  it('answer type is always "answer"', async () => {
    const { session: updated } = await sendAnswer(session, FAKE_SDP_ANSWER, pubkeyHex(caller.publicKey), callee);
    const answers = getAnswersForPeer(updated, pubkeyHex(caller.publicKey));
    expect(answers[0].type).toBe('answer');
  });
});

// --- getICECandidatesForPeer ---

describe('getICECandidatesForPeer', () => {
  let caller: Identity;
  let callee: Identity;
  let session: CallSession;

  beforeEach(async () => {
    caller = await createIdentity();
    callee = await createIdentity();
    const s = await startCall(caller, 'voice');
    const { session: s2 } = await joinCall(s, callee);
    session = s2;
  });

  it('returns empty array when no candidates sent', () => {
    const candidates = getICECandidatesForPeer(session, pubkeyHex(callee.publicKey));
    expect(candidates).toHaveLength(0);
  });

  it('returns the candidate after sendICECandidate', async () => {
    const { session: updated } = await sendICECandidate(session, FAKE_ICE, 0, pubkeyHex(callee.publicKey), caller);
    const candidates = getICECandidatesForPeer(updated, pubkeyHex(callee.publicKey));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].candidate).toBe(FAKE_ICE);
  });

  it('returns multiple ICE candidates for the same peer (trickle ICE)', async () => {
    const ICE_2 = 'candidate:1 1 UDP 1694498815 203.0.113.1 54321 typ srflx';
    const { session: s2 } = await sendICECandidate(session, FAKE_ICE, 0, pubkeyHex(callee.publicKey), caller);
    const { session: s3 } = await sendICECandidate(s2, ICE_2, 0, pubkeyHex(callee.publicKey), caller);
    const candidates = getICECandidatesForPeer(s3, pubkeyHex(callee.publicKey));
    expect(candidates).toHaveLength(2);
    expect(candidates[0].candidate).toBe(FAKE_ICE);
    expect(candidates[1].candidate).toBe(ICE_2);
  });

  it('only returns candidates for the specified peer', async () => {
    const third = await createIdentity();
    const { session: s2 } = await sendICECandidate(session, FAKE_ICE, 0, pubkeyHex(callee.publicKey), caller);
    const { session: s3 } = await sendICECandidate(s2, FAKE_ICE, 0, pubkeyHex(third.publicKey), caller);

    const forCallee = getICECandidatesForPeer(s3, pubkeyHex(callee.publicKey));
    const forThird = getICECandidatesForPeer(s3, pubkeyHex(third.publicKey));
    expect(forCallee).toHaveLength(1);
    expect(forThird).toHaveLength(1);
  });
});
