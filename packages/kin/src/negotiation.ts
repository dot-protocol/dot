/**
 * negotiation.ts — Kin-to-Kin term negotiation.
 *
 * When two Kin instances connect, they negotiate terms.
 * The outcome is the intersection of what both parties agree to.
 * The protocol defaults to the most private option when either side disagrees.
 *
 * Privacy is the default. Openness requires explicit mutual consent.
 */

/** Negotiation terms that two Kin instances agree on before communicating. */
export interface NegotiationTerms {
  /** Will you share your public key with the peer? */
  shareIdentity: boolean;
  /** Will you share your location with the peer? */
  shareLocation: boolean;
  /** Will you confirm that you have read messages (read receipts)? */
  readReceipts: boolean;
  /** Will you accept ephemeral (disappearing) DOTs from this peer? */
  acceptEphemeral: boolean;
}

/**
 * Compute agreed terms from two sets of proposed terms.
 *
 * The result is the AND-intersection of both parties' terms:
 * both must agree for a term to be active.
 * This defaults to the most private option when there is any disagreement.
 *
 * @param myTerms - This Kin instance's proposed terms
 * @param peerTerms - The peer Kin instance's proposed terms
 * @returns Agreed terms (both must consent)
 */
export function proposeTerm(
  myTerms: NegotiationTerms,
  peerTerms: NegotiationTerms
): NegotiationTerms {
  return {
    shareIdentity: myTerms.shareIdentity && peerTerms.shareIdentity,
    shareLocation: myTerms.shareLocation && peerTerms.shareLocation,
    readReceipts: myTerms.readReceipts && peerTerms.readReceipts,
    acceptEphemeral: myTerms.acceptEphemeral && peerTerms.acceptEphemeral,
  };
}

/**
 * Returns the default safe terms for a new Kin instance.
 *
 * Safe defaults: identity shared (needed for DOT signing), location private,
 * no read receipts, ephemeral DOTs accepted.
 *
 * @returns Default NegotiationTerms
 */
export function defaultTerms(): NegotiationTerms {
  return {
    shareIdentity: true,
    shareLocation: false,
    readReceipts: false,
    acceptEphemeral: true,
  };
}
