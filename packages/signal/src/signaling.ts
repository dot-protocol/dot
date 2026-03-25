/**
 * signaling.ts — SDP and ICE exchange via DOT chain.
 *
 * Every SDP offer, answer, and ICE candidate is a DOT appended to the
 * call session's chain. Signaling is signed, causal, and persistent —
 * the chain is the authoritative record of the WebRTC negotiation.
 *
 * DOT-RTC: WebRTC handles media codecs only. DOT handles all signaling.
 */

import { observe, sign } from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { append, walk } from '@dot-protocol/chain';
import type { CallSession, SDPPayload, ICEPayload, SignalPayloadEnvelope } from './types.js';

/** Hex-encode a public key. */
function pubkeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

/** Decode a DOT payload as JSON, returning null on failure. */
function decodePayload(dot: DOT): unknown | null {
  if (dot.payload === undefined) return null;
  try {
    return JSON.parse(new TextDecoder().decode(dot.payload));
  } catch {
    return null;
  }
}

/**
 * Append a signal envelope DOT to the session chain.
 * Returns the new session and the appended DOT.
 */
async function appendSignalDOT(
  session: CallSession,
  kind: string,
  observer: string,
  data: Record<string, unknown>,
  identity: Identity,
): Promise<{ session: CallSession; dot: DOT }> {
  const envelope: SignalPayloadEnvelope = { kind: kind as never, observer, data };
  const unsigned = observe(envelope, { type: 'event', plaintext: true });
  const dot = await sign(unsigned, identity.secretKey);
  const newChain = append(session.chain, dot);
  return { session: { ...session, chain: newChain }, dot };
}

/**
 * Send an SDP offer.
 *
 * The offer is stored as a DOT in the call chain — signed by the sender,
 * targeted at a specific peer by their hex public key.
 *
 * @param session - The current call session
 * @param sdp - The SDP string from RTCPeerConnection.createOffer()
 * @param targetPeer - Hex-encoded public key of the receiving peer
 * @param identity - The sender's identity
 * @returns Updated session and the appended offer DOT
 */
export async function sendOffer(
  session: CallSession,
  sdp: string,
  targetPeer: string,
  identity: Identity,
): Promise<{ session: CallSession; dot: DOT }> {
  const observer = pubkeyHex(identity.publicKey);
  return appendSignalDOT(session, 'sdp-offer', observer, { type: 'offer', sdp, targetPeer }, identity);
}

/**
 * Send an SDP answer.
 *
 * The answer is stored as a DOT in the call chain, targeted at the peer
 * that sent the corresponding offer.
 *
 * @param session - The current call session
 * @param sdp - The SDP string from RTCPeerConnection.createAnswer()
 * @param targetPeer - Hex-encoded public key of the offering peer
 * @param identity - The answerer's identity
 * @returns Updated session and the appended answer DOT
 */
export async function sendAnswer(
  session: CallSession,
  sdp: string,
  targetPeer: string,
  identity: Identity,
): Promise<{ session: CallSession; dot: DOT }> {
  const observer = pubkeyHex(identity.publicKey);
  return appendSignalDOT(session, 'sdp-answer', observer, { type: 'answer', sdp, targetPeer }, identity);
}

/**
 * Send an ICE candidate.
 *
 * Each ICE candidate is a DOT in the call chain. Multiple candidates can
 * be appended as trickle ICE progresses.
 *
 * @param session - The current call session
 * @param candidate - The ICE candidate string
 * @param index - The SDP media line index
 * @param targetPeer - Hex-encoded public key of the intended recipient
 * @param identity - The sender's identity
 * @returns Updated session and the appended ICE DOT
 */
export async function sendICECandidate(
  session: CallSession,
  candidate: string,
  index: number,
  targetPeer: string,
  identity: Identity,
): Promise<{ session: CallSession; dot: DOT }> {
  const observer = pubkeyHex(identity.publicKey);
  return appendSignalDOT(
    session,
    'ice-candidate',
    observer,
    { candidate, sdpMLineIndex: index, targetPeer },
    identity,
  );
}

/**
 * Get all SDP offers targeted at a specific peer.
 *
 * Walks the session chain and returns all 'sdp-offer' payloads
 * where targetPeer matches the given hex public key.
 *
 * @param session - The call session to search
 * @param peerPubKey - Hex-encoded public key of the recipient
 * @returns Array of SDPPayload objects (type='offer')
 */
export function getOffersForPeer(session: CallSession, peerPubKey: string): SDPPayload[] {
  const dots = walk(session.chain);
  const results: SDPPayload[] = [];

  for (const dot of dots) {
    const parsed = decodePayload(dot);
    if (parsed === null || typeof parsed !== 'object') continue;
    const env = parsed as SignalPayloadEnvelope;
    if (env.kind !== 'sdp-offer') continue;
    const data = env.data;
    if (data.targetPeer !== peerPubKey) continue;
    results.push({
      type: 'offer',
      sdp: data.sdp as string,
      targetPeer: data.targetPeer as string,
    });
  }

  return results;
}

/**
 * Get all SDP answers targeted at a specific peer.
 *
 * @param session - The call session to search
 * @param peerPubKey - Hex-encoded public key of the recipient
 * @returns Array of SDPPayload objects (type='answer')
 */
export function getAnswersForPeer(session: CallSession, peerPubKey: string): SDPPayload[] {
  const dots = walk(session.chain);
  const results: SDPPayload[] = [];

  for (const dot of dots) {
    const parsed = decodePayload(dot);
    if (parsed === null || typeof parsed !== 'object') continue;
    const env = parsed as SignalPayloadEnvelope;
    if (env.kind !== 'sdp-answer') continue;
    const data = env.data;
    if (data.targetPeer !== peerPubKey) continue;
    results.push({
      type: 'answer',
      sdp: data.sdp as string,
      targetPeer: data.targetPeer as string,
    });
  }

  return results;
}

/**
 * Get all ICE candidates targeted at a specific peer.
 *
 * @param session - The call session to search
 * @param peerPubKey - Hex-encoded public key of the recipient
 * @returns Array of ICEPayload objects
 */
export function getICECandidatesForPeer(session: CallSession, peerPubKey: string): ICEPayload[] {
  const dots = walk(session.chain);
  const results: ICEPayload[] = [];

  for (const dot of dots) {
    const parsed = decodePayload(dot);
    if (parsed === null || typeof parsed !== 'object') continue;
    const env = parsed as SignalPayloadEnvelope;
    if (env.kind !== 'ice-candidate') continue;
    const data = env.data;
    if (data.targetPeer !== peerPubKey) continue;
    results.push({
      candidate: data.candidate as string,
      sdpMLineIndex: data.sdpMLineIndex as number,
      targetPeer: data.targetPeer as string,
    });
  }

  return results;
}
