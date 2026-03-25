/**
 * renderer.ts — HTML Tree viewer renderer.
 *
 * Takes a ViewerTree and produces a single self-contained HTML document.
 * Dark theme. Collapsible nodes. Search. Trust visualization. Zero CDN deps.
 */

import type { ViewerTree, ViewerNode } from './types.js';
import { viewerCSS } from './styles.js';
import { searchScript } from './search.js';
import { addLeafScript } from './add-leaf.js';

// ── Trust helpers ──────────────────────────────────────────────────────────

function trustClass(trust: number): string {
  if (trust < 0.3) return 'vw-trust-red';
  if (trust < 0.7) return 'vw-trust-yellow';
  if (trust < 1.5) return 'vw-trust-green';
  return 'vw-trust-gold';
}

function trustLabel(trust: number): string {
  if (trust < 0.3) return 'low';
  if (trust < 0.7) return 'med';
  if (trust < 1.5) return 'ok';
  return 'high';
}

function chainDepthLabel(depth: number): string {
  if (depth === 0) return 'Genesis';
  if (depth <= 10) return `Shallow·${depth}`;
  if (depth <= 100) return `Estab·${depth}`;
  if (depth <= 999) return `Deep·${depth}`;
  return `Ancient·${depth}`;
}

function shortObserver(observer: string): string {
  return observer.slice(0, 8) + '…';
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Branch metadata ────────────────────────────────────────────────────────

const BRANCH_META: Record<string, { icon: string; accent: string }> = {
  observe: { icon: '👁', accent: '#818cf8' },
  flow:    { icon: '🌊', accent: '#34d399' },
  connect: { icon: '🔗', accent: '#fbbf24' },
};

function branchMeta(branch: string): { icon: string; accent: string } {
  return BRANCH_META[branch.toLowerCase()] ?? { icon: '◆', accent: '#818cf8' };
}

// ── Node rendering ─────────────────────────────────────────────────────────

function renderNodeDetail(node: ViewerNode): string {
  const formId = `vw-form-${escapeHtml(node.hash)}`;
  const leafBtn = `<button class="vw-add-leaf-btn" data-node-id="${escapeHtml(node.hash)}">+ Add Leaf</button>`;
  const leafForm = `
<div class="vw-add-leaf-form" id="${formId}" data-parent-hash="${escapeHtml(node.hash)}">
  <input class="vw-add-leaf-input" type="text" placeholder="Your observation…" autocomplete="off" />
  <button class="vw-add-leaf-submit">Add</button>
  <pre class="vw-add-leaf-output"></pre>
</div>`.trim();

  return `
<div class="vw-node-detail">
  <div class="vw-detail-content">${escapeHtml(node.content)}</div>
  <div class="vw-detail-meta">
    <div class="vw-detail-meta-item">
      <span class="vw-detail-meta-key">Hash</span>
      <span class="vw-detail-meta-val">${escapeHtml(node.hash)}</span>
    </div>
    <div class="vw-detail-meta-item">
      <span class="vw-detail-meta-key">Observer</span>
      <span class="vw-detail-meta-val">${escapeHtml(node.observer)}</span>
    </div>
    <div class="vw-detail-meta-item">
      <span class="vw-detail-meta-key">Trust</span>
      <span class="vw-detail-meta-val">${node.trust.toFixed(3)}</span>
    </div>
    <div class="vw-detail-meta-item">
      <span class="vw-detail-meta-key">Chain</span>
      <span class="vw-detail-meta-val">${node.chainDepth}</span>
    </div>
    <div class="vw-detail-meta-item">
      <span class="vw-detail-meta-key">Type</span>
      <span class="vw-detail-meta-val">${escapeHtml(node.type ?? '—')}</span>
    </div>
    <div class="vw-detail-meta-item">
      <span class="vw-detail-meta-key">Time</span>
      <span class="vw-detail-meta-val">${formatTimestamp(node.timestamp)}</span>
    </div>
  </div>
  ${leafBtn}
  ${leafForm}
</div>`.trim();
}

function renderNodeSummary(node: ViewerNode): string {
  const tc = trustClass(node.trust);
  const preview = node.content.length > 80 ? node.content.slice(0, 80) + '…' : node.content;
  const badge = `<span class="vw-trust-badge ${tc}">${escapeHtml(trustLabel(node.trust))} ${node.trust.toFixed(1)}</span>`;
  const depthChip = `<span class="vw-type-chip">${escapeHtml(chainDepthLabel(node.chainDepth))}</span>`;
  const obsShort = `<span class="vw-type-chip" title="${escapeHtml(node.observer)}">${escapeHtml(shortObserver(node.observer))}</span>`;

  return `
<summary class="vw-node-summary ${tc}"
  title="${escapeHtml(node.label)}"
>
  <div class="vw-node-main">
    <div class="vw-node-label">${escapeHtml(node.label)}</div>
    <div class="vw-node-preview">${escapeHtml(preview)}</div>
  </div>
  <div class="vw-node-badges">
    ${badge}
    ${depthChip}
    ${obsShort}
  </div>
</summary>`.trim();
}

function renderNodeRecursive(
  node: ViewerNode,
  nodeMap: Map<string, ViewerNode>,
  open: boolean,
): string {
  const hasChildren = node.children.length > 0;
  const childNodes = node.children
    .map((h) => nodeMap.get(h))
    .filter((n): n is ViewerNode => n !== undefined)
    .sort((a, b) => a.depth - b.depth);

  const childrenHtml =
    hasChildren && childNodes.length > 0
      ? `<div class="vw-children">${childNodes.map((c) => renderNodeRecursive(c, nodeMap, false)).join('\n')}</div>`
      : '';

  return `
<div class="vw-node"
  data-label="${escapeHtml(node.label)}"
  data-content="${escapeHtml(node.content)}"
>
  <details${open ? ' open' : ''}>
    ${renderNodeSummary(node)}
    ${renderNodeDetail(node)}
  </details>
  ${childrenHtml}
</div>`.trim();
}

// ── Branch rendering ───────────────────────────────────────────────────────

function renderBranch(
  branchName: string,
  rootNode: ViewerNode,
  nodeMap: Map<string, ViewerNode>,
  totalCount: number,
): string {
  const meta = branchMeta(branchName);
  return `
<div class="vw-branch" data-branch="${escapeHtml(branchName)}">
  <details open>
    <summary class="vw-branch-summary">
      <span class="vw-branch-icon">${meta.icon}</span>
      <span class="vw-branch-label">${escapeHtml(branchName.charAt(0).toUpperCase() + branchName.slice(1))}</span>
      <span class="vw-branch-count">${totalCount}</span>
      <span class="vw-branch-chevron">▶</span>
    </summary>
    <div class="vw-branch-body">
      ${renderNodeRecursive(rootNode, nodeMap, true)}
    </div>
  </details>
</div>`.trim();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Renders a ViewerTree to a complete, self-contained HTML document.
 *
 * @param tree - The tree to render
 * @returns Full HTML string (DOCTYPE … </html>)
 */
export function renderTree(tree: ViewerTree): string {
  const title = tree.title ?? 'DOT Tree Viewer';
  const createdStr = tree.created ? new Date(tree.created).toISOString().slice(0, 10) : '';

  // Build lookup map: hash → node
  const nodeMap = new Map<string, ViewerNode>();
  for (const node of tree.nodes) {
    nodeMap.set(node.hash, node);
  }

  if (tree.nodes.length === 0) {
    const emptyBody = `<div class="vw-empty">No observations yet.</div>`;
    return buildDocument(title, createdStr, emptyBody, 0);
  }

  // Group roots by branch, preserving roots array order
  const branchOrder = new Map<string, ViewerNode>();
  for (const rootHash of tree.roots) {
    const node = nodeMap.get(rootHash);
    if (node && !branchOrder.has(node.branch)) {
      branchOrder.set(node.branch, node);
    }
  }

  // Count total descendants per branch root (inclusive)
  function countDescendants(hash: string, visited = new Set<string>()): number {
    if (visited.has(hash)) return 0;
    visited.add(hash);
    const n = nodeMap.get(hash);
    if (!n) return 0;
    return 1 + n.children.reduce((s, c) => s + countDescendants(c, visited), 0);
  }

  const branchesHtml = Array.from(branchOrder.entries())
    .map(([branch, rootNode]) => {
      const count = countDescendants(rootNode.hash);
      return renderBranch(branch, rootNode, nodeMap, count);
    })
    .join('\n');

  const body = `
<div class="vw-search-wrap">
  <input
    id="vw-search"
    class="vw-search"
    type="search"
    placeholder="Search observations…"
    autocomplete="off"
    aria-label="Search tree nodes"
  />
</div>
${branchesHtml}
<div id="vw-no-results">No matching observations.</div>
`.trim();

  return buildDocument(title, createdStr, body, tree.nodes.length);
}

function buildDocument(
  title: string,
  created: string,
  bodyContent: string,
  nodeCount: number,
): string {
  const metaLine = [
    nodeCount > 0 ? `${nodeCount} observations` : '',
    created ? `Created ${created}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
${viewerCSS()}
  </style>
</head>
<body>
  <div class="vw-wrap">
    <div class="vw-header">
      <div class="vw-title">${escapeHtml(title)}</div>
      ${metaLine ? `<div class="vw-meta">${escapeHtml(metaLine)}</div>` : ''}
    </div>
    ${bodyContent}
  </div>
  ${searchScript()}
  ${addLeafScript()}
</body>
</html>`;
}
