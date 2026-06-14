/**
 * DOT Protocol v0.3.0 — Arena Elo Engine
 *
 * Per-domain Elo ratings computed from prediction/resolution DOT pairs.
 */

import type { ArenaMatch } from './types.js';

export const ELO_DEFAULT = 1500;
const ELO_K_FACTOR = 32;

export interface EloUpdate {
  domain: string;
  correct: boolean;
}

export function updateElo(current: number, update: EloUpdate): number {
  const expectedScore = 0.5;
  const actualScore = update.correct ? 1 : 0;
  return Math.round(current + ELO_K_FACTOR * (actualScore - expectedScore));
}

export function applyEloUpdates(
  existingElo: Map<string, number>,
  updates: EloUpdate[]
): Map<string, number> {
  const next = new Map(existingElo);
  for (const update of updates) {
    next.set(update.domain, updateElo(next.get(update.domain) ?? ELO_DEFAULT, update));
  }
  return next;
}

/**
 * Compute Elo deltas for a batch of arena matches.
 * Returns a map of domain → new Elo rating.
 */
export function computeEloFromMatches(
  existingElo: Map<string, number>,
  matches: ArenaMatch[]
): Map<string, number> {
  const updates: EloUpdate[] = matches.map((m) => ({
    domain: m.prediction.domain,
    correct: m.correct,
  }));
  return applyEloUpdates(existingElo, updates);
}

/**
 * Compute Elo percentile of a given rating against a population.
 * Returns 0–1 (1 = top of population).
 */
export function computeEloPercentile(rating: number, population: number[]): number {
  if (population.length === 0) return 0.5;
  const below = population.filter((r) => r < rating).length;
  return below / population.length;
}

/**
 * Produce a ranked leaderboard from a map of pubkey → Elo scores.
 */
export function rankLeaderboard(
  domain: string,
  entries: Array<{ pubkey: string; elo: number; totalPredictions: number; correctPredictions: number }>
): import('./types.js').LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.elo - a.elo);
  return sorted.map((e, i) => ({
    ...e,
    domain,
    rank: i + 1,
    accuracy: e.totalPredictions > 0 ? e.correctPredictions / e.totalPredictions : 0,
  }));
}
