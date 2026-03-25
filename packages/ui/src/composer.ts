/**
 * composer.ts — Compose patterns into room interfaces.
 *
 * Given a room name and its current state, the composer automatically selects
 * and arranges the right patterns. The Room AI calls this to generate a
 * RoomLayout; clients render it.
 */

import {
  observationFirst,
  mindPresence,
  chainBeneath,
  doorway,
  sovereignStop,
  threshold,
  type UIComponent,
} from './patterns.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A complete room interface layout, ready for rendering or serialization. */
export interface RoomLayout {
  /** Unique layout identifier — room name + timestamp */
  id: string;
  /** The room this layout is for */
  roomName: string;
  /** Ordered components to render (top to bottom, left to right) */
  components: UIComponent[];
  /** UI theme */
  theme: 'dark' | 'light';
  /** ISO timestamp of layout generation */
  generatedAt: string;
}

/** Options passed to composeRoomLayout to describe current room state. */
export interface ComposeOptions {
  /** Active minds to surface via mindPresence */
  minds?: { name: string; domain: string; active?: boolean }[];
  /** Recent DOTs to show via chainBeneath */
  recentDots?: { hash: string; content: string; depth: number; trust: number }[];
  /** Related rooms to surface as doorways */
  doorways?: { room: string; relevance: string; preview?: string }[];
  /** Kin sovereign stop state */
  kinState?: { stopped: boolean; reason?: string; resumeAction?: string };
  /** Whether this is the human's first visit to the room */
  firstVisit?: boolean;
  /** Theme preference */
  theme?: 'dark' | 'light';
  /** Observation input placeholder */
  inputPlaceholder?: string;
}

// ─── Composer ─────────────────────────────────────────────────────────────────

/**
 * Compose a RoomLayout from a room name and current state options.
 *
 * Layout logic:
 * 1. Always: observationFirst (Pattern 6) at top — the room listens first
 * 2. First visit only: threshold (Pattern 1) — minimal entry question
 * 3. If kinState.stopped: sovereignStop (Pattern 5) overlays everything
 * 4. If minds: mindPresence (Pattern 3) — show who is present
 * 5. If recentDots: chainBeneath (Pattern 4) — surface the chain
 * 6. If doorways: doorway (Pattern 8) — cross-room portals
 *
 * @param roomName - The room name, e.g. ".physics" or ".the.first.room"
 * @param options - Current room state options
 * @returns A fully composed RoomLayout
 */
export function composeRoomLayout(roomName: string, options: ComposeOptions = {}): RoomLayout {
  const {
    minds,
    recentDots,
    doorways,
    kinState,
    firstVisit = false,
    theme = 'dark',
    inputPlaceholder,
  } = options;

  const components: UIComponent[] = [];

  // 1. Observation First — always at the top. The room listens.
  components.push(observationFirst(inputPlaceholder, roomName));

  // 2. Threshold — only on first visit. One question to begin.
  if (firstVisit) {
    components.push(
      threshold(
        `What brings you to ${roomName}?`,
        `Tell the room what you observe...`,
      ),
    );
  }

  // 3. Mind Presence — surface the minds that are here.
  if (minds && minds.length > 0) {
    const normalizedMinds = minds.map((m) => ({
      name: m.name,
      domain: m.domain,
      active: m.active ?? false,
    }));
    components.push(mindPresence(normalizedMinds));
  }

  // 4. Chain Beneath — surface the DOT chain.
  if (recentDots && recentDots.length > 0) {
    components.push(chainBeneath(recentDots));
  }

  // 5. Doorways — cross-room portals.
  if (doorways && doorways.length > 0) {
    for (const d of doorways) {
      components.push(doorway(d.room, d.relevance, d.preview));
    }
  }

  // 6. Sovereign Stop — overlays when Kin has stopped. Added last so it renders
  //    on top of everything else.
  if (kinState?.stopped) {
    components.push(
      sovereignStop(
        kinState.reason ?? 'Kin has paused this room.',
        kinState.resumeAction,
      ),
    );
  }

  const id = `layout:${roomName}:${Date.now()}`;

  return {
    id,
    roomName,
    components,
    theme,
    generatedAt: new Date().toISOString(),
  };
}
