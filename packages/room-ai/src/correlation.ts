/**
 * correlation.ts — Cross-room discovery engine.
 *
 * The CorrelationEngine tracks known .rooms and their keyword/domain profiles.
 * When a query+response pair is processed, it detects which other rooms might
 * be relevant and suggests doorway connections.
 *
 * Simple design: keyword overlap scoring. No embeddings, no API — pure text.
 * Fast, deterministic, testable.
 */

import type { CrossRoomLink } from './types.js';
import type { DOT } from '@dot-protocol/core';

/** A known room's profile for correlation matching. */
export interface KnownRoom {
  /** Room name, e.g. ".physics", ".poetry", ".general" */
  name: string;
  /** Keywords associated with this room's topics. */
  keywords: string[];
  /** Mind domains active in this room. */
  mindDomains: string[];
}

/**
 * CorrelationEngine — detects cross-room relevance.
 *
 * Register known rooms with their keyword/domain profiles.
 * Given a query+response, it returns rooms that likely have relevant knowledge.
 *
 * @example
 * const engine = new CorrelationEngine();
 * engine.registerRoom({ name: '.physics', keywords: ['quantum', 'energy'], mindDomains: ['physics'] });
 * const links = engine.findCorrelations('What is entropy?', 'Entropy is disorder...');
 * // Returns [{ room: '.physics', relevance: 0.8, reason: '...' }]
 */
export class CorrelationEngine {
  /** All registered rooms, keyed by name. */
  knownRooms: Map<string, KnownRoom> = new Map();

  /** Minimum relevance score to include in results. */
  private readonly threshold: number;

  constructor(threshold = 0.1) {
    this.threshold = threshold;
  }

  /**
   * Register a room for correlation matching.
   * Overwrites any existing registration with the same name.
   */
  registerRoom(room: KnownRoom): void {
    // Deep copy arrays to avoid mutation from caller
    this.knownRooms.set(room.name, {
      name: room.name,
      keywords: [...room.keywords],
      mindDomains: [...room.mindDomains],
    });
  }

  /**
   * Remove a room from correlation matching.
   */
  unregisterRoom(name: string): void {
    this.knownRooms.delete(name);
  }

  /**
   * Find rooms that are relevant to a given query and response.
   *
   * Scoring:
   * - +0.4 for each query keyword matching a room keyword
   * - +0.3 for each response keyword matching a room keyword
   * - +0.3 for each query/response keyword matching a room's mindDomains
   * Normalized to [0, 1].
   *
   * @param query - The original query text
   * @param response - The response text (concatenated from all mind responses)
   * @param excludeRoom - Optional room name to exclude (the current room)
   * @returns Array of cross-room links sorted by relevance desc
   */
  findCorrelations(query: string, response: string, excludeRoom?: string): CrossRoomLink[] {
    const queryKeywords = extractWords(query);
    const responseKeywords = extractWords(response);
    const allKeywords = [...new Set([...queryKeywords, ...responseKeywords])];

    const results: CrossRoomLink[] = [];

    for (const [name, room] of this.knownRooms) {
      if (name === excludeRoom) continue;

      const roomKeywordsLower = room.keywords.map((k) => k.toLowerCase());
      const roomDomainsLower = room.mindDomains.map((d) => d.toLowerCase());

      // Score query overlap
      const queryMatches = queryKeywords.filter((kw) =>
        roomKeywordsLower.some((rk) => rk.includes(kw) || kw.includes(rk)),
      );

      // Score response overlap
      const responseMatches = responseKeywords.filter((kw) =>
        roomKeywordsLower.some((rk) => rk.includes(kw) || kw.includes(rk)),
      );

      // Score domain overlap — use partial stem matching (first 5 chars)
      // This handles "mathematics"/"mathematical", "physics"/"physical", etc.
      const domainMatches = allKeywords.filter((kw) =>
        roomDomainsLower.some((rd) => {
          if (rd.includes(kw) || kw.includes(rd)) return true;
          // Stem match: compare first min(5, len) characters
          const stemLen = Math.min(5, Math.min(rd.length, kw.length));
          if (stemLen >= 4 && rd.slice(0, stemLen) === kw.slice(0, stemLen)) return true;
          return false;
        }),
      );

      // Compute raw score — use additive scoring instead of ratio-based
      // to avoid dilution by large keyword counts
      const baseScore =
        queryMatches.length * 0.4 +
        responseMatches.length * 0.3 +
        domainMatches.length * 0.3;

      // Normalize: cap at 1.0, don't divide by keyword count (additive is fairer)
      const rawScore = Math.min(1.0, baseScore * 0.5);

      // Cap at 1.0
      const relevance = Math.min(1.0, Math.round(rawScore * 100) / 100);

      if (relevance >= this.threshold) {
        const matchedTerms = [
          ...new Set([
            ...queryMatches.slice(0, 2),
            ...responseMatches.slice(0, 2),
            ...domainMatches.slice(0, 2),
          ]),
        ].slice(0, 3);

        const reason =
          matchedTerms.length > 0
            ? `Shared concepts: ${matchedTerms.join(', ')}`
            : `Topic overlap with ${room.mindDomains.join(', ')} domain`;

        results.push({ room: name, relevance, reason });
      }
    }

    // Sort by relevance descending
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * Given recent activity (state DOTs) in a room, suggest doorways to related rooms.
   *
   * Extracts topics from recent DOT payloads and matches against known rooms.
   *
   * @param roomName - The room whose activity is being analyzed
   * @param recentDots - Recent DOTs from that room
   * @returns Suggested doorways with reasons
   */
  suggestDoorways(
    roomName: string,
    recentDots: DOT[],
  ): { targetRoom: string; reason: string }[] {
    if (recentDots.length === 0) return [];

    // Extract text from recent DOT payloads
    const texts: string[] = [];
    for (const dot of recentDots) {
      if (dot.payload === undefined) continue;
      try {
        const text = new TextDecoder().decode(dot.payload);
        const obj = JSON.parse(text) as Record<string, unknown>;
        // Collect string values from the payload
        for (const val of Object.values(obj)) {
          if (typeof val === 'string' && val.length > 3) {
            texts.push(val);
          }
        }
      } catch {
        // Skip unparseable payloads
      }
    }

    if (texts.length === 0) return [];

    const combinedText = texts.join(' ');
    const links = this.findCorrelations(combinedText, '', roomName);

    return links.map((link) => ({
      targetRoom: link.room,
      reason: link.reason,
    }));
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'what', 'how', 'why', 'when', 'where', 'who',
  'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'this', 'that', 'it', 'its', 'about', 'tell', 'me',
]);

/**
 * Extract meaningful words from a text string.
 * Filters stop words and short words.
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}
