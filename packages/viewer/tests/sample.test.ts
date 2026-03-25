/**
 * sample.test.ts — Tests for the sample tree generator.
 */

import { describe, it, expect } from 'vitest';
import { createSampleTree } from '../src/sample.js';

describe('createSampleTree', () => {
  it('returns a ViewerTree object', () => {
    const tree = createSampleTree();
    expect(tree).toBeDefined();
    expect(Array.isArray(tree.nodes)).toBe(true);
    expect(Array.isArray(tree.roots)).toBe(true);
  });

  it('has approximately 20 nodes (within ±5)', () => {
    const { nodes } = createSampleTree();
    expect(nodes.length).toBeGreaterThanOrEqual(14);
    expect(nodes.length).toBeLessThanOrEqual(25);
  });

  it('has exactly 3 root hashes', () => {
    expect(createSampleTree().roots).toHaveLength(3);
  });

  it('has 3 distinct root branches: observe, flow, connect', () => {
    const tree = createSampleTree();
    const branches = tree.roots.map(h => tree.nodes.find(n => n.hash === h)?.branch);
    expect(branches).toContain('observe');
    expect(branches).toContain('flow');
    expect(branches).toContain('connect');
  });

  it('every node has required fields', () => {
    for (const node of createSampleTree().nodes) {
      expect(typeof node.hash).toBe('string');
      expect(typeof node.label).toBe('string');
      expect(typeof node.content).toBe('string');
      expect(typeof node.branch).toBe('string');
      expect(typeof node.depth).toBe('number');
      expect(Array.isArray(node.children)).toBe(true);
      expect(typeof node.trust).toBe('number');
      expect(typeof node.chainDepth).toBe('number');
      expect(typeof node.observer).toBe('string');
    }
  });

  it('all root hashes exist in nodes array', () => {
    const tree = createSampleTree();
    const hashSet = new Set(tree.nodes.map(n => n.hash));
    for (const r of tree.roots) {
      expect(hashSet.has(r)).toBe(true);
    }
  });

  it('has mix of trust levels (at least 3 distinct levels)', () => {
    const trusts = createSampleTree().nodes.map(n => n.trust);
    const levels = new Set(trusts.map(t => t < 0.3 ? 'red' : t < 0.7 ? 'yellow' : t < 1.5 ? 'green' : 'gold'));
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  it('has mix of types (claim and event/measure)', () => {
    const types = new Set(createSampleTree().nodes.map(n => n.type).filter(Boolean));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('has a title', () => {
    expect(typeof createSampleTree().title).toBe('string');
    expect((createSampleTree().title ?? '').length).toBeGreaterThan(0);
  });

  it('has a created timestamp', () => {
    const ts = createSampleTree().created;
    expect(typeof ts).toBe('number');
    expect(ts).toBeGreaterThan(0);
  });

  it('no duplicate hashes in nodes', () => {
    const nodes = createSampleTree().nodes;
    const hashes = nodes.map(n => n.hash);
    const unique = new Set(hashes);
    expect(unique.size).toBe(nodes.length);
  });
});
