/**
 * types.ts — Room AI data model for @dot-protocol/room-ai.
 *
 * Every .room has a Room AI that governs it:
 * - Routes queries to relevant minds
 * - Manages compute budgets
 * - Detects cross-room correlations
 * - Enforces start/stop
 * - Creates state DOTs as checkpoints
 */

import type { DOT } from '@dot-protocol/core';

// Re-export for convenience
export type { DOT };

/** Configuration for a Room AI instance. */
export interface RoomAIConfig {
  /** Maximum number of minds to activate per query. Default: 3 */
  maxMindsPerQuery: number;
  /** Relevance threshold [0-1] — minds must score above this. Default: 0.3 */
  relevanceThreshold: number;
  /** Maximum tokens (compute units) per interaction. Default: 4096 */
  computeBudget: number;
  /** Enable cross-room correlation detection. Default: true */
  crossRoomEnabled: boolean;
  /** Create a state DOT every N observations. Default: 10 */
  stateDotInterval: number;
}

/** The result of a Room AI handling a query. */
export interface QueryResult {
  /** Responses collected from activated minds. */
  mindResponses: MindQueryResponse[];
  /** Cross-room links discovered from this query/response pair. */
  crossRoomLinks: CrossRoomLink[];
  /** State DOT created at this interval checkpoint (if applicable). */
  stateDot?: DOT;
}

/** A single mind's response to a query. */
export interface MindQueryResponse {
  /** Mind ID (e.g. "feynman", "rumi"). */
  mind: string;
  /** The response text. */
  response: string;
  /** Citations from the mind's knowledge base. */
  citations: string[];
  /** Confidence score 0–1. */
  confidence: number;
}

/** A cross-room correlation detected by the CorrelationEngine. */
export interface CrossRoomLink {
  /** Target room name (e.g. ".physics"). */
  room: string;
  /** Relevance score 0–1. */
  relevance: number;
  /** Human-readable reason for the suggestion. */
  reason: string;
}

/** Tracks compute usage for a Room AI session. */
export interface ComputeUsage {
  /** Tokens used so far. */
  tokensUsed: number;
  /** Total budget. */
  budget: number;
  /** Remaining budget. */
  remaining: number;
  /** Number of minds activated across all queries. */
  mindsActivated: number;
}

/** Interaction limit state for a member. */
export interface InteractionLimit {
  /** Member public key (hex). */
  memberKey: string;
  /** Number of interactions so far. */
  count: number;
  /** Hard limit before enforceStop returns true. 0 = no limit. */
  limit: number;
}
