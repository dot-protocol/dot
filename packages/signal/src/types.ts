/**
 * types.ts — DOT-RTC type definitions.
 *
 * DOT-RTC uses WebRTC for audio/video codecs ONLY.
 * Everything else (signaling, identity, session state) is DOT.
 *
 * A CallSession is a DOT chain: each event (join, leave, SDP, ICE) is a DOT.
 * The chain is the call log — signed, persistent, verifiable.
 */

import type { Chain } from '@dot-protocol/chain';

// Re-export Chain for consumers that need it.
export type { Chain };

/** A DOT-RTC call session backed by a DOT chain. */
export interface CallSession {
  /** Unique session identifier. */
  id: string;
  /** The call event log as a DOT chain. */
  chain: Chain;
  /** Participants currently or previously in this call. */
  participants: Map<string, CallParticipant>;
  /** Current call state. */
  state: 'initiating' | 'ringing' | 'active' | 'ended';
  /** Unix ms when the call became active. */
  startedAt?: number;
  /** Unix ms when the call ended. */
  endedAt?: number;
  /** Whether this is a voice-only or video call. */
  type: 'voice' | 'video';
}

/** A participant in a DOT-RTC call. */
export interface CallParticipant {
  /** Ed25519 public key — the participant's identity. */
  publicKey: Uint8Array;
  /** Optional display name. */
  name?: string;
  /** Unix ms when this participant joined. */
  joinedAt: number;
  /** Unix ms when this participant left (undefined if still active). */
  leftAt?: number;
  /** Whether the participant is muted. */
  muted: boolean;
  /** Whether the participant's video is off. */
  videoOff: boolean;
}

/**
 * DOT type tags for call signaling events.
 * These are stored as DOT.type = 'event' with the specific kind
 * encoded in the payload as JSON.
 */
export type SignalDOTType =
  | 'call-start'
  | 'call-join'
  | 'call-leave'
  | 'call-end'
  | 'sdp-offer'
  | 'sdp-answer'
  | 'ice-candidate'
  | 'mute'
  | 'unmute'
  | 'video-on'
  | 'video-off';

/** Payload shape for an SDP offer or answer DOT. */
export interface SDPPayload {
  /** SDP type: 'offer' or 'answer'. */
  type: 'offer' | 'answer';
  /** The SDP string from WebRTC. */
  sdp: string;
  /** Hex-encoded public key of the intended recipient peer. */
  targetPeer: string;
}

/** Payload shape for an ICE candidate DOT. */
export interface ICEPayload {
  /** ICE candidate string. */
  candidate: string;
  /** SDP media line index. */
  sdpMLineIndex: number;
  /** Hex-encoded public key of the intended recipient peer. */
  targetPeer: string;
}

/** Internal payload envelope stored in every signal DOT. */
export interface SignalPayloadEnvelope {
  /** The signal kind. */
  kind: SignalDOTType;
  /** The observer's public key (hex) — who sent this signal. */
  observer: string;
  /** Signal-specific data. */
  data: Record<string, unknown>;
}

/** Quality metrics for a call health report. */
export interface QualityMetrics {
  /** Round-trip time in milliseconds. */
  rttMs: number;
  /** Packet loss as a percentage (0–100). */
  packetLossPercent: number;
  /** Current bitrate in kbps. */
  bitrateKbps: number;
  /** Audio level (0.0–1.0). */
  audioLevel: number;
}
