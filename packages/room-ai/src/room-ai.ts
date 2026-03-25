/**
 * room-ai.ts — The Room AI governance engine.
 *
 * Every .room has a Room AI. It is the room's intelligence layer:
 * - Routes incoming queries to relevant minds
 * - Activates up to N minds per query (configurable)
 * - Tracks compute budget across the session
 * - Detects cross-room correlations
 * - Creates state DOTs at configured intervals
 * - Enforces start/stop (currently: Kin enforces, Room AI defers)
 *
 * The Room AI is not a mind. It does not respond to queries itself.
 * It orchestrates minds and returns their aggregated responses.
 */

import type { DOT } from '@dot-protocol/core';
import { observe, sign } from '@dot-protocol/core';
import { append, bufToHex } from '@dot-protocol/chain';
import type { Room, Mind } from '@dot-protocol/room';
import { shouldActivateMind } from '@dot-protocol/room';
import type { Mind as MindEntity } from '@dot-protocol/minds';
import type {
  RoomAIConfig,
  QueryResult,
  MindQueryResponse,
  ComputeUsage,
} from './types.js';
import { CorrelationEngine } from './correlation.js';
import { crystallize } from './crystallize.js';

// Stop words to filter from routing — short/common words cause false matches
const ROUTE_STOP_WORDS = new Set([
  'tell', 'what', 'with', 'that', 'this', 'from', 'have', 'will',
  'your', 'more', 'also', 'some', 'into', 'they', 'when', 'then',
  'than', 'each', 'over', 'about', 'which', 'there', 'their', 'been',
  'were', 'does', 'just', 'like', 'very', 'much', 'such', 'most',
  'only', 'both', 'even', 'same', 'take', 'know', 'make', 'look',
  'time', 'come', 'work', 'best', 'good', 'want', 'give', 'those',
]);

/** Default Room AI configuration. */
const DEFAULT_CONFIG: RoomAIConfig = {
  maxMindsPerQuery: 3,
  relevanceThreshold: 0.3,
  computeBudget: 4096,
  crossRoomEnabled: true,
  stateDotInterval: 10,
};

/**
 * The Room AI — governance engine for a .room.
 *
 * @example
 * const room = await createRoom('.physics');
 * const feynman = await createFeynman();
 * const ai = new RoomAI(room, [feynman]);
 *
 * const result = await ai.handleQuery('What is entropy?', userPublicKey);
 * console.log(result.mindResponses[0].response);
 * console.log(result.crossRoomLinks);
 */
export class RoomAI {
  /** The .room this AI governs. */
  room: Room;

  /** Minds available to this AI (from @dot-protocol/minds). */
  minds: MindEntity[];

  /** Configuration. */
  config: RoomAIConfig;

  /** Running compute usage. */
  computeUsage: ComputeUsage;

  /** Number of observations handled (used for stateDotInterval). */
  observationCount: number;

  /** Cross-room correlation engine. */
  private readonly correlationEngine: CorrelationEngine;

  /** Per-member interaction counts for enforceStop. */
  private readonly interactionCounts: Map<string, number>;

  constructor(room: Room, minds: MindEntity[], config?: Partial<RoomAIConfig>) {
    this.room = room;
    this.minds = minds;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.computeUsage = {
      tokensUsed: 0,
      budget: this.config.computeBudget,
      remaining: this.config.computeBudget,
      mindsActivated: 0,
    };
    this.observationCount = 0;
    this.correlationEngine = new CorrelationEngine(this.config.relevanceThreshold);
    this.interactionCounts = new Map();
  }

  /**
   * Handle an incoming query from a room member.
   *
   * Steps:
   * 1. Route query to relevant minds (by domain matching)
   * 2. Activate up to maxMindsPerQuery minds
   * 3. Collect responses with citations and confidence scores
   * 4. Check for cross-room correlations (if enabled)
   * 5. Track compute usage
   * 6. Create state DOT if observation interval reached
   * 7. Return aggregated results
   *
   * @param query - The query text
   * @param askerIdentity - Public key of the member asking (for compute tracking)
   * @returns Aggregated QueryResult
   */
  async handleQuery(query: string, askerIdentity: Uint8Array): Promise<QueryResult> {
    // Track interaction for this member
    const memberKey = bufToHex(askerIdentity);
    this.interactionCounts.set(
      memberKey,
      (this.interactionCounts.get(memberKey) ?? 0) + 1,
    );

    // Route to relevant minds
    const activatedMinds = this.routeToMinds(query);

    // Collect responses from each activated mind
    const mindResponses: MindQueryResponse[] = [];
    for (const mind of activatedMinds) {
      const response = await mind.respond(query);

      // Estimate token cost (rough: 1 token ≈ 4 chars)
      const estimatedTokens = Math.ceil((query.length + response.text.length) / 4);
      this.computeUsage.tokensUsed += estimatedTokens;
      this.computeUsage.remaining = Math.max(
        0,
        this.config.computeBudget - this.computeUsage.tokensUsed,
      );
      this.computeUsage.mindsActivated++;

      mindResponses.push({
        mind: mind.config.id,
        response: response.text,
        citations: response.citations.map((c) => c.source),
        confidence: response.confidence,
      });
    }

    this.observationCount++;

    // Cross-room correlation
    let crossRoomLinks: QueryResult['crossRoomLinks'] = [];
    if (this.config.crossRoomEnabled) {
      const combinedResponse = mindResponses.map((r) => r.response).join(' ');
      crossRoomLinks = this.checkCrossRoom(query, combinedResponse);
    }

    // State DOT at interval
    let stateDot: DOT | undefined;
    if (
      this.config.stateDotInterval > 0 &&
      this.observationCount % this.config.stateDotInterval === 0
    ) {
      stateDot = await this.createStateDOT();
    }

    return { mindResponses, crossRoomLinks, stateDot };
  }

  /**
   * Route a query to the most relevant minds.
   *
   * Scoring uses shouldActivateMind from @dot-protocol/room (domain matching).
   * Additionally considers Mind.config.domain arrays from @dot-protocol/minds
   * for richer matching.
   *
   * Returns up to maxMindsPerQuery minds above the relevanceThreshold.
   *
   * @param query - The query string
   * @returns Ordered array of minds to activate
   */
  routeToMinds(query: string): MindEntity[] {
    const queryLower = query.toLowerCase();

    // Extract meaningful query words (min 4 chars, no stop words)
    const queryWords = queryLower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !ROUTE_STOP_WORDS.has(w));

    const scored = this.minds
      .map((mind) => {
        // Score against each domain in the mind's domain array
        const domains: string[] = Array.isArray(mind.config.domain)
          ? mind.config.domain
          : [mind.config.domain as string];

        let score = 0;

        for (const domain of domains) {
          const domainLower = domain.toLowerCase();

          // Direct full-domain substring match in the full query (strongest signal)
          if (queryLower.includes(domainLower)) {
            score += 1.0;
            continue;
          }

          // Word-level: query word must be at least 4 chars to avoid noise
          for (const word of queryWords) {
            if (word.length < 4) continue;
            // Domain contains the query word (e.g. "physics" contains "physic")
            // OR query word contains a domain word that is at least 5 chars
            if (domainLower.includes(word)) {
              score += 0.6;
            } else if (word.includes(domainLower) && domainLower.length >= 5) {
              score += 0.6;
            }
          }
        }

        // Also check against room's Mind type (if the mind is registered in the room)
        const roomMind = this.room.minds.get(mind.config.id);
        if (roomMind !== undefined) {
          const roomMindType: Mind = roomMind;
          if (shouldActivateMind(query, roomMindType)) {
            score += 0.3;
          }
        }

        return { mind, score };
      })
      .filter((s) => s.score >= this.config.relevanceThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxMindsPerQuery)
      .map((s) => s.mind);

    return scored;
  }

  /**
   * Detect cross-room correlations from a query+response pair.
   *
   * Delegates to the CorrelationEngine. Provides the current room's name
   * as the exclusion so the current room doesn't recommend itself.
   *
   * @param query - The original query
   * @param response - Combined response text from all activated minds
   * @returns Cross-room link suggestions
   */
  checkCrossRoom(
    query: string,
    response: string,
  ): { room: string; relevance: number; reason: string }[] {
    return this.correlationEngine.findCorrelations(query, response, this.room.name);
  }

  /**
   * Create a state DOT snapshot of the room.
   * Signed by the room's own identity.
   *
   * The DOT is appended to the room's chain and returned.
   */
  async createStateDOT(): Promise<DOT> {
    return crystallize(this.room, this, this.room.identity);
  }

  /**
   * Get current compute usage.
   */
  getComputeUsage(): ComputeUsage {
    return { ...this.computeUsage };
  }

  /**
   * Check if this member has exceeded their interaction limit.
   *
   * Currently always returns false — Kin enforces stop, not the Room AI.
   * The Room AI respects Kin's authority over session management.
   *
   * @param askerIdentity - The member's public key
   * @returns false (Kin enforces stop)
   */
  enforceStop(_askerIdentity: Uint8Array): boolean {
    // Kin enforces stop. Room AI defers.
    return false;
  }

  /**
   * Register a known room with the correlation engine.
   * Called when the Room AI becomes aware of peer rooms.
   */
  registerKnownRoom(room: import('./correlation.js').KnownRoom): void {
    this.correlationEngine.registerRoom(room);
  }

  /**
   * Get the current observation count.
   */
  getObservationCount(): number {
    return this.observationCount;
  }

  /**
   * Append a query DOT to the room's chain.
   * Records the query as an observation in the room's permanent record.
   *
   * @param query - Query text
   * @param askerIdentity - The asker's keypair (for signing)
   */
  async appendQueryDOT(
    query: string,
    askerIdentity: { publicKey: Uint8Array; secretKey: Uint8Array },
  ): Promise<DOT> {
    const dot = observe(
      { event: 'query', content: query, room: this.room.name },
      { type: 'claim', plaintext: true },
    );
    const signed = await sign(dot, askerIdentity.secretKey);
    this.room.chain = append(this.room.chain, signed);
    return signed;
  }
}
