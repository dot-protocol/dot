/**
 * serializer.ts — A2UI JSON format serialization for DOT room layouts.
 *
 * toA2UI: RoomLayout → JSON string (what Room AI sends to clients)
 * fromA2UI: JSON string → RoomLayout (what clients parse)
 *
 * The A2UI format is a superset of Google's A2UI declarative JSON spec,
 * extended with DOT-specific fields (roomName, theme, generatedAt).
 */

import type { UIComponent } from './patterns.js';
import type { RoomLayout } from './composer.js';

// ─── A2UI Wire Format ─────────────────────────────────────────────────────────

/**
 * The A2UI wire format envelope.
 * This is what crosses the wire between Room AI and clients.
 */
interface A2UIEnvelope {
  /** A2UI format version */
  a2ui: '1.0';
  /** Layout identifier */
  id: string;
  /** Room this layout is for */
  room: string;
  /** UI theme */
  theme: 'dark' | 'light';
  /** ISO timestamp */
  generatedAt: string;
  /** Component tree */
  components: A2UIComponent[];
}

/**
 * A2UI component in wire format.
 * Mirrors UIComponent but uses 'type' instead of 'pattern' for A2UI compat.
 */
interface A2UIComponent {
  /** Component identifier */
  id: string;
  /** Component type (A2UI uses 'type', we map from 'pattern') */
  type: string;
  /** Component properties */
  props: Record<string, unknown>;
  /** Child components */
  children?: A2UIComponent[];
}

// ─── Serialization ────────────────────────────────────────────────────────────

function componentToA2UI(component: UIComponent): A2UIComponent {
  const result: A2UIComponent = {
    id: component.id,
    type: component.pattern,
    props: component.props,
  };

  if (component.children && component.children.length > 0) {
    result.children = component.children.map(componentToA2UI);
  }

  return result;
}

/**
 * Serialize a RoomLayout to A2UI-compatible JSON string.
 *
 * This is what Room AI generates and sends to clients.
 * Clients parse it with fromA2UI to get a RoomLayout for rendering.
 *
 * @param layout - The layout to serialize
 * @returns A valid A2UI JSON string
 */
export function toA2UI(layout: RoomLayout): string {
  const envelope: A2UIEnvelope = {
    a2ui: '1.0',
    id: layout.id,
    room: layout.roomName,
    theme: layout.theme,
    generatedAt: layout.generatedAt,
    components: layout.components.map(componentToA2UI),
  };

  return JSON.stringify(envelope, null, 2);
}

// ─── Deserialization ──────────────────────────────────────────────────────────

function a2UIToComponent(a2c: A2UIComponent): UIComponent {
  const result: UIComponent = {
    id: a2c.id,
    pattern: a2c.type as UIComponent['pattern'],
    props: a2c.props,
  };

  if (a2c.children && a2c.children.length > 0) {
    result.children = a2c.children.map(a2UIToComponent);
  }

  return result;
}

/**
 * Parse an A2UI JSON string back to a RoomLayout.
 *
 * @param json - The A2UI JSON string from Room AI
 * @returns A RoomLayout ready for rendering
 * @throws If the JSON is invalid or missing required fields
 */
export function fromA2UI(json: string): RoomLayout {
  let envelope: A2UIEnvelope;

  try {
    envelope = JSON.parse(json) as A2UIEnvelope;
  } catch (e) {
    throw new Error(`fromA2UI: invalid JSON — ${(e as Error).message}`);
  }

  if (envelope.a2ui !== '1.0') {
    throw new Error(
      `fromA2UI: unsupported A2UI version "${String(envelope.a2ui)}" — expected "1.0"`,
    );
  }

  if (!envelope.id || typeof envelope.id !== 'string') {
    throw new Error('fromA2UI: missing required field "id"');
  }

  if (!envelope.room || typeof envelope.room !== 'string') {
    throw new Error('fromA2UI: missing required field "room"');
  }

  if (!Array.isArray(envelope.components)) {
    throw new Error('fromA2UI: "components" must be an array');
  }

  const layout: RoomLayout = {
    id: envelope.id,
    roomName: envelope.room,
    theme: envelope.theme === 'light' ? 'light' : 'dark',
    generatedAt: envelope.generatedAt ?? new Date().toISOString(),
    components: envelope.components.map(a2UIToComponent),
  };

  return layout;
}
