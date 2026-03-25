/**
 * session.ts — Call session management via DOT chain.
 *
 * Every call lifecycle event (start, join, leave, end) is a DOT appended
 * to the session's chain. The chain IS the call log.
 */

import { observe, sign, createIdentity } from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { createChain, append } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';
import type {
  CallSession,
  CallParticipant,
  SignalPayloadEnvelope,
} from './types.js';

/** Encode a public key to hex for use as a map key. */
function pubkeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

/**
 * Append a signal event DOT to the session chain.
 * Returns a new session with the updated chain.
 */
async function appendSignalDOT(
  session: CallSession,
  kind: string,
  observer: string,
  data: Record<string, unknown>,
  identity?: Identity,
): Promise<{ session: CallSession; dot: DOT }> {
  const envelope: SignalPayloadEnvelope = { kind: kind as never, observer, data };
  const unsigned = observe(envelope, { type: 'event', plaintext: true });

  let dot: DOT;
  if (identity !== undefined) {
    dot = await sign(unsigned, identity.secretKey);
  } else {
    dot = unsigned as DOT;
  }

  const newChain = append(session.chain, dot);
  const newSession: CallSession = { ...session, chain: newChain };
  return { session: newSession, dot };
}

/**
 * Start a new call session.
 *
 * Creates a DOT chain for the call. The first DOT is the genesis event
 * with kind='call-start'.
 *
 * @param identity - The caller's identity (used to sign DOTs)
 * @param type - Voice-only or video call
 * @returns A new CallSession in 'initiating' state
 */
export async function startCall(
  identity: Identity,
  type: 'voice' | 'video',
): Promise<CallSession> {
  const chain = createChain();
  const id = chain.id;

  // Build the initiating session (no participants yet)
  const session: CallSession = {
    id,
    chain,
    participants: new Map(),
    state: 'initiating',
    type,
  };

  const observer = pubkeyHex(identity.publicKey);
  const { session: updated } = await appendSignalDOT(
    session,
    'call-start',
    observer,
    { type, callId: id },
    identity,
  );

  return updated;
}

/**
 * Join an existing call session.
 *
 * Appends a 'call-join' DOT to the chain and adds the participant.
 * Sets the session state to 'active' if it was 'initiating' or 'ringing'.
 *
 * @param session - The session to join
 * @param identity - The joining participant's identity
 * @param name - Optional display name
 * @returns Updated session and the new participant record
 */
export async function joinCall(
  session: CallSession,
  identity: Identity,
  name?: string,
): Promise<{ session: CallSession; participant: CallParticipant }> {
  if (session.state === 'ended') {
    throw new Error('Cannot join a call that has ended');
  }

  const observer = pubkeyHex(identity.publicKey);
  const joinedAt = Date.now();

  const participant: CallParticipant = {
    publicKey: identity.publicKey,
    name,
    joinedAt,
    muted: false,
    videoOff: false,
  };

  // Build updated participants map
  const newParticipants = new Map(session.participants);
  newParticipants.set(observer, participant);

  // Transition state: initiating/ringing → active on first join
  const newState: CallSession['state'] =
    session.state === 'initiating' || session.state === 'ringing' ? 'active' : session.state;

  const intermediate: CallSession = {
    ...session,
    participants: newParticipants,
    state: newState,
    startedAt: newState === 'active' && session.startedAt === undefined ? joinedAt : session.startedAt,
  };

  const { session: updated } = await appendSignalDOT(
    intermediate,
    'call-join',
    observer,
    { name, joinedAt, callId: session.id },
    identity,
  );

  return { session: updated, participant };
}

/**
 * Leave a call session.
 *
 * Appends a 'call-leave' DOT and marks the participant as having left.
 *
 * @param session - The current session
 * @param identity - The leaving participant's identity
 * @returns Updated session
 */
export async function leaveCall(
  session: CallSession,
  identity: Identity,
): Promise<CallSession> {
  if (session.state === 'ended') {
    throw new Error('Cannot leave a call that has already ended');
  }

  const observer = pubkeyHex(identity.publicKey);
  const leftAt = Date.now();

  // Mark participant as left
  const newParticipants = new Map(session.participants);
  const existing = newParticipants.get(observer);
  if (existing !== undefined) {
    newParticipants.set(observer, { ...existing, leftAt });
  }

  const intermediate: CallSession = { ...session, participants: newParticipants };

  const { session: updated } = await appendSignalDOT(
    intermediate,
    'call-leave',
    observer,
    { leftAt, callId: session.id },
    identity,
  );

  return updated;
}

/**
 * End a call session permanently.
 *
 * Appends a 'call-end' DOT and transitions state to 'ended'.
 * All remaining participants are implicitly marked as left.
 *
 * @param session - The current session
 * @param identity - The identity ending the call
 * @returns Updated session in 'ended' state
 */
export async function endCall(
  session: CallSession,
  identity: Identity,
): Promise<CallSession> {
  if (session.state === 'ended') {
    throw new Error('Call has already ended');
  }

  const observer = pubkeyHex(identity.publicKey);
  const endedAt = Date.now();

  // Mark all still-active participants as left
  const newParticipants = new Map(session.participants);
  for (const [key, p] of newParticipants) {
    if (p.leftAt === undefined) {
      newParticipants.set(key, { ...p, leftAt: endedAt });
    }
  }

  const intermediate: CallSession = {
    ...session,
    participants: newParticipants,
    state: 'ended',
    endedAt,
  };

  const { session: updated } = await appendSignalDOT(
    intermediate,
    'call-end',
    observer,
    { endedAt, callId: session.id },
    identity,
  );

  return updated;
}

/**
 * Compute the current call state from the session.
 *
 * @returns Active participants, call duration (ms or 0 if not started), and state string
 */
export function getCallState(session: CallSession): {
  participants: CallParticipant[];
  duration: number;
  state: string;
} {
  const now = Date.now();
  const participants = Array.from(session.participants.values());
  const duration =
    session.startedAt !== undefined
      ? (session.endedAt ?? now) - session.startedAt
      : 0;

  return {
    participants,
    duration,
    state: session.state,
  };
}
