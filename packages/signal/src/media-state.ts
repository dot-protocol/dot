/**
 * media-state.ts — Mute and video state as DOTs.
 *
 * Every mute/unmute and video-on/off event is a DOT in the call chain.
 * The current state for any participant is derived by scanning the chain
 * for the most recent relevant event — no separate state store needed.
 */

import { observe, sign } from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { append, walk } from '@dot-protocol/chain';
import type { CallSession, SignalPayloadEnvelope } from './types.js';

/** Hex-encode a public key. */
function pubkeyHex(pk: Uint8Array): string {
  return Buffer.from(pk).toString('hex');
}

/** Decode a DOT payload as an envelope, returning null if not parseable. */
function decodeEnvelope(dot: DOT): SignalPayloadEnvelope | null {
  if (dot.payload === undefined) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(dot.payload));
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('kind' in parsed) || !('observer' in parsed)) return null;
    return parsed as SignalPayloadEnvelope;
  } catch {
    return null;
  }
}

/**
 * Toggle mute state for a participant.
 *
 * Appends a 'mute' or 'unmute' DOT to the call chain, signed by the
 * participant's identity.
 *
 * @param session - The current call session
 * @param identity - The participant's identity
 * @param muted - True to mute, false to unmute
 * @returns Updated session and the appended DOT
 */
export async function toggleMute(
  session: CallSession,
  identity: Identity,
  muted: boolean,
): Promise<{ session: CallSession; dot: DOT }> {
  const observer = pubkeyHex(identity.publicKey);
  const kind = muted ? 'mute' : 'unmute';
  const envelope: SignalPayloadEnvelope = {
    kind: kind as never,
    observer,
    data: { muted, timestamp: Date.now() },
  };
  const unsigned = observe(envelope, { type: 'event', plaintext: true });
  const dot = await sign(unsigned, identity.secretKey);
  const newChain = append(session.chain, dot);
  return { session: { ...session, chain: newChain }, dot };
}

/**
 * Toggle video state for a participant.
 *
 * Appends a 'video-off' or 'video-on' DOT to the call chain.
 *
 * @param session - The current call session
 * @param identity - The participant's identity
 * @param videoOff - True to turn video off, false to turn it on
 * @returns Updated session and the appended DOT
 */
export async function toggleVideo(
  session: CallSession,
  identity: Identity,
  videoOff: boolean,
): Promise<{ session: CallSession; dot: DOT }> {
  const observer = pubkeyHex(identity.publicKey);
  const kind = videoOff ? 'video-off' : 'video-on';
  const envelope: SignalPayloadEnvelope = {
    kind: kind as never,
    observer,
    data: { videoOff, timestamp: Date.now() },
  };
  const unsigned = observe(envelope, { type: 'event', plaintext: true });
  const dot = await sign(unsigned, identity.secretKey);
  const newChain = append(session.chain, dot);
  return { session: { ...session, chain: newChain }, dot };
}

/**
 * Get the current media state for a participant.
 *
 * Scans the chain from oldest to newest; later events override earlier ones.
 * Returns defaults (unmuted, video on) if no media events found for this participant.
 *
 * @param session - The call session to inspect
 * @param publicKey - The participant's public key
 * @returns { muted, videoOff } reflecting the latest events for this participant
 */
export function getMediaState(
  session: CallSession,
  publicKey: Uint8Array,
): { muted: boolean; videoOff: boolean } {
  const targetHex = pubkeyHex(publicKey);
  const dots = walk(session.chain);

  let muted = false;
  let videoOff = false;

  for (const dot of dots) {
    const env = decodeEnvelope(dot);
    if (env === null) continue;
    if (env.observer !== targetHex) continue;

    if (env.kind === 'mute') {
      muted = true;
    } else if (env.kind === 'unmute') {
      muted = false;
    } else if (env.kind === 'video-off') {
      videoOff = true;
    } else if (env.kind === 'video-on') {
      videoOff = false;
    }
  }

  return { muted, videoOff };
}
