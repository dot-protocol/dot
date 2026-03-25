/**
 * tree-adapter.ts — Convert @dot-protocol/tree Tree to @dot-protocol/viewer ViewerTree.
 *
 * The two packages have separate types. This module bridges them so the browser
 * runtime can render a live Tree through the existing viewer renderer.
 */

import type { Tree, TreeNode } from '@dot-protocol/tree';
import type { ViewerTree, ViewerNode } from '@dot-protocol/viewer';

/**
 * Converts a live Tree (from @dot-protocol/tree) into a ViewerTree
 * suitable for renderTree() from @dot-protocol/viewer.
 *
 * @param tree - The live Tree to convert
 * @param title - Optional title for the viewer document
 */
export function treeToViewerTree(tree: Tree, title = 'DOT Protocol Tree'): ViewerTree {
  const nodes: ViewerNode[] = [];
  const roots: string[] = [];

  // Collect all root hashes in branch order
  for (const [, rootNode] of tree.roots) {
    roots.push(rootNode.hash);
  }

  // Walk all nodes and convert to ViewerNode
  for (const [hash, treeNode] of tree.nodes) {
    const viewerNode = treeNodeToViewerNode(treeNode, hash);
    nodes.push(viewerNode);
  }

  return {
    nodes,
    roots,
    title,
    created: Date.now(),
  };
}

// ── Private ────────────────────────────────────────────────────────────────

function treeNodeToViewerNode(node: TreeNode, hash: string): ViewerNode {
  const dot = node.dot;

  // Extract content from DOT payload
  const content = extractContent(dot.payload);

  // Trust score based on DOT completeness level
  const trust = computeTrust(node);

  // Observer hex pubkey
  const observer = dot.sign?.observer
    ? bytesToHex(dot.sign.observer)
    : '0000000000000000';

  // Chain depth
  const chainDepth = dot.chain?.depth ?? node.depth;

  // Timestamp
  const timestamp = dot.time?.utc;

  return {
    hash,
    label: node.label ?? content.slice(0, 80),
    content,
    branch: node.branch,
    depth: node.depth,
    children: node.children,
    parent: node.parent,
    trust,
    chainDepth,
    observer,
    timestamp,
    type: dot.type,
  };
}

function extractContent(payload: Uint8Array | undefined): string {
  if (!payload || payload.length === 0) return '(empty)';
  try {
    return new TextDecoder().decode(payload);
  } catch {
    return `(binary: ${payload.length} bytes)`;
  }
}

function computeTrust(node: TreeNode): number {
  const dot = node.dot;
  let score = 0;

  // Has signature = +1
  if (dot.sign?.signature) score += 1;

  // Has chain = +0.5
  if (dot.chain?.depth !== undefined && dot.chain.depth > 0) score += 0.5;

  // Has verify hash = +0.5
  if (dot.verify?.hash) score += 0.5;

  // Has timestamp = +0.25
  if (dot.time?.utc) score += 0.25;

  // Deep chain = bonus
  const depth = dot.chain?.depth ?? 0;
  if (depth > 50) score += 0.25;
  if (depth > 200) score += 0.25;

  return Math.max(0, score);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
