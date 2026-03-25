/**
 * @dot-protocol/signal — WebRTC signaling via DOT chain.
 *
 * DOT-RTC: WebRTC handles audio/video codecs only.
 * Everything else (signaling, identity, session state) is DOT.
 *
 * Every call event is a signed DOT appended to the session's chain:
 * - Call lifecycle (start, join, leave, end)
 * - SDP offers and answers
 * - ICE candidates
 * - Mute/video state
 * - Quality reports
 *
 * The chain IS the call log: signed, persistent, verifiable.
 */

// Types
export type {
  CallSession,
  CallParticipant,
  SignalDOTType,
  SDPPayload,
  ICEPayload,
  SignalPayloadEnvelope,
  QualityMetrics,
} from './types.js';

// Session management
export {
  startCall,
  joinCall,
  leaveCall,
  endCall,
  getCallState,
} from './session.js';

// SDP / ICE signaling
export {
  sendOffer,
  sendAnswer,
  sendICECandidate,
  getOffersForPeer,
  getAnswersForPeer,
  getICECandidatesForPeer,
} from './signaling.js';

// Media state
export {
  toggleMute,
  toggleVideo,
  getMediaState,
} from './media-state.js';

// Call health
export {
  reportQuality,
  getCallHealth,
} from './call-health.js';
