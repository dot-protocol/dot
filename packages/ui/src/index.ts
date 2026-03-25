/**
 * @dot-protocol/ui — A2UI-inspired generative interface catalog for DOT rooms.
 *
 * The Room AI generates JSON component descriptors. Clients render natively.
 * Ten patterns. One room. Many faces.
 *
 * @example
 * import { composeRoomLayout, renderToHTML, toA2UI, fromA2UI } from '@dot-protocol/ui';
 *
 * // Room AI composes the layout
 * const layout = composeRoomLayout('.physics', {
 *   minds: [{ name: 'Feynman', domain: 'physics', active: true }],
 *   firstVisit: true,
 * });
 *
 * // Render to HTML for web clients
 * const html = renderToHTML(layout);
 *
 * // Or serialize to A2UI JSON for native clients
 * const json = toA2UI(layout);
 */

// Pattern types and factory functions
export type { PatternType, UIComponent } from './patterns.js';
export {
  threshold,
  revelation,
  mindPresence,
  chainBeneath,
  sovereignStop,
  observationFirst,
  citationTrail,
  doorway,
  ephemeralSurface,
  generativeFace,
  resetIdCounter,
} from './patterns.js';

// Composer — assemble patterns into room layouts
export type { RoomLayout, ComposeOptions } from './composer.js';
export { composeRoomLayout } from './composer.js';

// Renderer — HTML output for web clients
export { renderToHTML } from './renderer.js';

// Serializer — A2UI JSON wire format
export { toA2UI, fromA2UI } from './serializer.js';
