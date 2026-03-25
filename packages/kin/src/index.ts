/**
 * @dot-protocol/kin — The human's local AI OS.
 *
 * Kin manages identity, privacy, verification, and sovereign stop conditions.
 * It is the firewall between the person and every .room in the mesh.
 *
 * R854: Kin runs locally. No remote party can override its stop conditions.
 *       Privacy-first. Observation requires explicit consent.
 */

// Core Kin class
export { Kin } from './kin.js';
export type { VerificationResult } from './kin.js';

// Types
export type { KinConfig, KinState, StopConditions } from './types.js';

// Privacy
export { detectPII, reformulate } from './privacy.js';
export type { PIIDetection } from './privacy.js';

// Stop conditions
export { checkStopConditions, isRoomBlocked } from './stop.js';
export type { StopDecision } from './stop.js';

// Kin-to-Kin negotiation
export { proposeTerm, defaultTerms } from './negotiation.js';
export type { NegotiationTerms } from './negotiation.js';
