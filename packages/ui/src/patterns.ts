/**
 * patterns.ts — The 10 A2UI-inspired generative interface patterns for DOT rooms.
 *
 * These are JSON descriptors, NOT React components. Any renderer (HTML, React,
 * native, terminal) can interpret and render them. The Room AI generates these
 * descriptors; clients render natively.
 *
 * Inspired by Google's A2UI declarative JSON format for agent-generated UIs.
 */

// ─── Core Types ───────────────────────────────────────────────────────────────

/**
 * The 10 generative interface patterns.
 * Each pattern encodes a specific UX philosophy from the DOT protocol design.
 */
export type PatternType =
  | 'threshold'        // Minimal entry — one question to begin
  | 'revelation'       // Progressive disclosure — summary → detail → full
  | 'mind-presence'    // Show active minds in the room
  | 'chain-beneath'    // DOT chain surfaced beneath the UI
  | 'sovereign-stop'   // Kin boundary — hard stop with reason
  | 'observation-first' // Input always visible — observe before responding
  | 'citation-trail'   // Inline provenance — every claim sourced
  | 'doorway'          // Cross-room discovery — portals to other rooms
  | 'ephemeral-surface' // Visual fade but permanent chain
  | 'generative-face'; // Same room, different interface per human

/**
 * A single UI component descriptor.
 * This is the atomic unit of the A2UI-inspired format.
 */
export interface UIComponent {
  /** Unique identifier for this component instance */
  id: string;
  /** Which pattern this component implements */
  pattern: PatternType;
  /** Pattern-specific properties */
  props: Record<string, unknown>;
  /** Nested child components */
  children?: UIComponent[];
}

// ─── ID Generation ────────────────────────────────────────────────────────────

let _idCounter = 0;

/**
 * Generate a deterministic component ID.
 * Uses pattern prefix + monotonic counter for uniqueness within a session.
 */
function makeId(pattern: PatternType): string {
  _idCounter++;
  return `${pattern}-${_idCounter}`;
}

/** Reset the ID counter. Used in tests for deterministic IDs. */
export function resetIdCounter(): void {
  _idCounter = 0;
}

// ─── Pattern 1: Threshold ─────────────────────────────────────────────────────

/**
 * Threshold — minimal entry point. One question. No preamble.
 * The room waits. You begin.
 *
 * @param question - The single question to present at room entry
 * @param placeholder - Input placeholder text (optional)
 */
export function threshold(question: string, placeholder?: string): UIComponent {
  return {
    id: makeId('threshold'),
    pattern: 'threshold',
    props: {
      question,
      placeholder: placeholder ?? 'Begin here...',
    },
  };
}

// ─── Pattern 2: Revelation ────────────────────────────────────────────────────

/**
 * Revelation — progressive disclosure across three levels.
 * The summary is always visible. Detail expands on tap. Full on intent.
 *
 * @param levels - Three levels of disclosure: summary, detail, full
 */
export function revelation(levels: {
  summary: string;
  detail: string;
  full: string;
}): UIComponent {
  return {
    id: makeId('revelation'),
    pattern: 'revelation',
    props: {
      summary: levels.summary,
      detail: levels.detail,
      full: levels.full,
      currentLevel: 'summary',
    },
  };
}

// ─── Pattern 3: Mind Presence ─────────────────────────────────────────────────

/**
 * Mind Presence — surface the minds present in the room.
 * Active minds glow. Inactive minds fade. The room is never empty.
 *
 * @param minds - Array of minds with name, domain, and active status
 */
export function mindPresence(
  minds: { name: string; domain: string; active: boolean }[],
): UIComponent {
  return {
    id: makeId('mind-presence'),
    pattern: 'mind-presence',
    props: {
      minds,
      activeCount: minds.filter((m) => m.active).length,
      totalCount: minds.length,
    },
  };
}

// ─── Pattern 4: Chain Beneath ─────────────────────────────────────────────────

/**
 * Chain Beneath — the DOT chain surfaced under the visual interface.
 * Every message has a hash. Every hash links to the one before.
 *
 * @param dots - The DOTs to display, with hash, content preview, depth, and trust
 */
export function chainBeneath(
  dots: { hash: string; content: string; depth: number; trust: number }[],
): UIComponent {
  return {
    id: makeId('chain-beneath'),
    pattern: 'chain-beneath',
    props: {
      dots,
      tipHash: dots.length > 0 ? dots[dots.length - 1]!.hash : null,
      chainDepth: dots.length,
    },
  };
}

// ─── Pattern 5: Sovereign Stop ────────────────────────────────────────────────

/**
 * Sovereign Stop — Kin's boundary. A hard stop with a clear reason.
 * Not an error. A decision. The room pauses. Kin explains.
 *
 * @param reason - Why Kin has stopped
 * @param resumeAction - Optional action to resume (label for the button)
 */
export function sovereignStop(reason: string, resumeAction?: string): UIComponent {
  return {
    id: makeId('sovereign-stop'),
    pattern: 'sovereign-stop',
    props: {
      reason,
      resumeAction: resumeAction ?? null,
      stopped: true,
      stoppedAt: Date.now(),
    },
  };
}

// ─── Pattern 6: Observation First ────────────────────────────────────────────

/**
 * Observation First — the input is always visible.
 * Observe before you respond. The room listens before it speaks.
 *
 * @param placeholder - Input placeholder text
 * @param room - Room name this observation goes into
 */
export function observationFirst(placeholder?: string, room?: string): UIComponent {
  return {
    id: makeId('observation-first'),
    pattern: 'observation-first',
    props: {
      placeholder: placeholder ?? 'What do you observe?',
      room: room ?? null,
      alwaysVisible: true,
      position: 'top',
    },
  };
}

// ─── Pattern 7: Citation Trail ────────────────────────────────────────────────

/**
 * Citation Trail — every claim is sourced. Inline provenance.
 * Truth is not asserted. Truth is traced.
 *
 * @param claims - Array of claims with text, source, and confidence
 */
export function citationTrail(
  claims: { text: string; source: string; confidence: number }[],
): UIComponent {
  const validated = claims.map((c) => ({
    ...c,
    confidence: Math.max(0, Math.min(1, c.confidence)),
  }));

  return {
    id: makeId('citation-trail'),
    pattern: 'citation-trail',
    props: {
      claims: validated,
      avgConfidence:
        validated.length > 0
          ? validated.reduce((sum, c) => sum + c.confidence, 0) / validated.length
          : 0,
    },
  };
}

// ─── Pattern 8: Doorway ───────────────────────────────────────────────────────

/**
 * Doorway — a portal to another room. Cross-room discovery.
 * The web of rooms is navigable. No room is an island.
 *
 * @param targetRoom - The room name to link to (e.g. ".physics")
 * @param relevance - Why this doorway is surfaced here
 * @param preview - Optional preview of what's in the other room
 */
export function doorway(targetRoom: string, relevance: string, preview?: string): UIComponent {
  return {
    id: makeId('doorway'),
    pattern: 'doorway',
    props: {
      targetRoom,
      relevance,
      preview: preview ?? null,
    },
  };
}

// ─── Pattern 9: Ephemeral Surface ────────────────────────────────────────────

/**
 * Ephemeral Surface — the visual fades. The chain is permanent.
 * What you see disappears. What was observed is forever.
 *
 * @param content - The content to show before it fades
 * @param ttlSeconds - Time-to-live in seconds before the surface fades
 */
export function ephemeralSurface(content: string, ttlSeconds: number): UIComponent {
  const expiresAt = Date.now() + ttlSeconds * 1000;

  return {
    id: makeId('ephemeral-surface'),
    pattern: 'ephemeral-surface',
    props: {
      content,
      ttlSeconds: Math.max(1, ttlSeconds),
      expiresAt,
      permanent: true, // The DOT chain persists even after visual fade
    },
  };
}

// ─── Pattern 10: Generative Face ─────────────────────────────────────────────

/**
 * Generative Face — the same room, a different interface per human.
 * The room adapts to who is observing it.
 *
 * @param humanContext - Language and expertise level of the human
 * @param components - The components to render for this human's context
 */
export function generativeFace(
  humanContext: { language: string; expertise: string },
  components: UIComponent[],
): UIComponent {
  return {
    id: makeId('generative-face'),
    pattern: 'generative-face',
    props: {
      humanContext: {
        language: humanContext.language,
        expertise: humanContext.expertise,
      },
    },
    children: components,
  };
}
