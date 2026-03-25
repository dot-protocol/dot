/**
 * @dot-protocol/viewer — Tree viewer HTML generator.
 *
 * Takes a ViewerTree (JSON) and renders a self-contained HTML document.
 * Dark theme. Collapsible nodes. Search. Trust colors. Zero CDN deps.
 *
 * Usage:
 *   import { renderTree, createSampleTree } from '@dot-protocol/viewer';
 *   const html = renderTree(createSampleTree());
 */

// Types
export type { ViewerNode, ViewerTree } from './types.js';

// Renderer
export { renderTree } from './renderer.js';

// CSS / Scripts (for embedding or testing)
export { viewerCSS } from './styles.js';
export { searchScript } from './search.js';
export { addLeafScript } from './add-leaf.js';

// Sample data
export { createSampleTree } from './sample.js';
