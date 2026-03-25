/**
 * types.ts — Viewer data model.
 *
 * ViewerNode: a single observable point in the Tree.
 * ViewerTree: the full graph with root pointers.
 */

export interface ViewerNode {
  /** Unique identifier — hex hash of the DOT payload. */
  hash: string;
  /** Human-readable label for display. */
  label: string;
  /** Full observation content. */
  content: string;
  /** Top-level branch name: 'observe' | 'flow' | 'connect' (or custom). */
  branch: string;
  /** Depth from root (root = 0). */
  depth: number;
  /** Hashes of direct child nodes. */
  children: string[];
  /** Hash of the parent node (absent for root nodes). */
  parent?: string;
  /** Trust score 0–3+ computed from chain and signatures. */
  trust: number;
  /** How deep this DOT's chain is. */
  chainDepth: number;
  /** Hex pubkey of signer (short form shown in UI). */
  observer: string;
  /** Unix ms timestamp when the observation was made. */
  timestamp?: number;
  /** Observation type, e.g. 'claim' | 'event' | 'measure'. */
  type?: string;
}

export interface ViewerTree {
  /** All nodes keyed by position in array (lookup by hash via index). */
  nodes: ViewerNode[];
  /** Hashes of root (top-level) nodes. */
  roots: string[];
  /** Optional document title shown in the viewer. */
  title?: string;
  /** Unix ms when this tree was created. */
  created?: number;
}
