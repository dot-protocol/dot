/**
 * governance.ts — Room AI basics: routing queries to minds, budget tracking.
 *
 * Governance defines which minds respond to a query and tracks compute budgets.
 */

import { observe, sign, hash } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { append, bufToHex } from '@dot-protocol/chain';
import type { Room, Mind } from './types.js';

export interface GovernanceConfig {
  /** Maximum number of minds to activate per query */
  maxMindsPerQuery: number;
  /** Relevance threshold [0-1] — minds must score above this */
  relevanceThreshold: number;
  /** Max compute units per interaction */
  computeBudget: number;
}

const DEFAULT_GOVERNANCE: GovernanceConfig = {
  maxMindsPerQuery: 3,
  relevanceThreshold: 0.5,
  computeBudget: 1000,
};

/**
 * Determine if a mind's domain is relevant to a query.
 *
 * Simple keyword/domain matching:
 * - Splits the query into words (lowercased)
 * - Checks if any word matches (or contains) the mind's domain
 *
 * @param query - The query string
 * @param mind - The candidate mind
 * @returns true if the mind's domain is relevant
 */
export function shouldActivateMind(query: string, mind: Mind): boolean {
  if (!mind.active) return false;

  const queryLower = query.toLowerCase();
  const domainLower = mind.domain.toLowerCase();
  const words = queryLower.split(/\s+/);

  // Direct domain match in full query
  if (queryLower.includes(domainLower)) return true;

  // Any word matches domain
  for (const word of words) {
    if (word.includes(domainLower) || domainLower.includes(word)) {
      return true;
    }
  }

  return false;
}

/**
 * Route a query to the relevant minds in the room.
 *
 * @param room - The room containing minds
 * @param query - The query string
 * @param config - Governance config (optional, uses defaults)
 * @returns Array of minds that should respond (max N from config)
 */
export function routeQuery(
  room: Room,
  query: string,
  config: GovernanceConfig = DEFAULT_GOVERNANCE,
): Mind[] {
  const candidates: Mind[] = [];

  for (const mind of room.minds.values()) {
    if (shouldActivateMind(query, mind)) {
      candidates.push(mind);
    }
  }

  // Sort by domain length descending (more specific domains rank higher)
  candidates.sort((a, b) => b.domain.length - a.domain.length);

  return candidates.slice(0, config.maxMindsPerQuery);
}

/**
 * Create a state snapshot DOT for the room.
 * Signed by the room's own identity.
 *
 * @param room - The room to snapshot
 */
export async function createStateDOT(room: Room): Promise<DOT> {
  const memberCount = room.members.size;
  const dotCount = room.chain.appendCount;

  // Compute state hash from counts + tip
  const enc = new TextEncoder();
  const raw = enc.encode(`${memberCount}:${dotCount}:${room.chain.tipHash ?? ''}`);
  const stateDot: DOT = { payload: raw, payload_mode: 'plain' };
  const stateHashBytes = hash(stateDot);
  const stateHash = bufToHex(stateHashBytes);

  const dot = observe(
    {
      event: 'state_snapshot',
      memberCount,
      dotCount,
      mindCount: room.minds.size,
      stateHash,
    },
    { type: 'state', plaintext: true },
  );
  const signed = await sign(dot, room.identity.secretKey);
  room.chain = append(room.chain, signed);

  return signed;
}
