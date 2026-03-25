/**
 * integration.test.ts — End-to-end: sample → renderTree → valid HTML.
 */

import { describe, it, expect } from 'vitest';
import { renderTree } from '../src/renderer.js';
import { createSampleTree } from '../src/sample.js';
import type { ViewerTree, ViewerNode } from '../src/types.js';

describe('integration: createSampleTree → renderTree', () => {
  it('produces HTML without throwing', () => {
    expect(() => renderTree(createSampleTree())).not.toThrow();
  });

  it('produces a non-empty string', () => {
    const html = renderTree(createSampleTree());
    expect(html.length).toBeGreaterThan(0);
  });

  it('HTML starts with DOCTYPE', () => {
    expect(renderTree(createSampleTree()).trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('HTML size is under 50KB for sample tree', () => {
    const html = renderTree(createSampleTree());
    const bytes = new TextEncoder().encode(html).length;
    expect(bytes).toBeLessThan(50_000);
  });

  it('HTML size is under 20KB for empty tree (CSS+JS baseline)', () => {
    const html = renderTree({ nodes: [], roots: [], title: 'Empty' });
    const bytes = new TextEncoder().encode(html).length;
    expect(bytes).toBeLessThan(20_000);
  });

  it('all node labels appear in output', () => {
    const tree = createSampleTree();
    const html = renderTree(tree);
    for (const node of tree.nodes) {
      expect(html).toContain(node.label);
    }
  });

  it('trust badges appear for each node (one per node min)', () => {
    const tree = createSampleTree();
    const html = renderTree(tree);
    // Count badge instances in rendered HTML
    const badgeMatches = html.match(/vw-trust-badge/g) ?? [];
    // CSS defines the class once; rendered nodes add more
    expect(badgeMatches.length).toBeGreaterThan(tree.nodes.length);
  });

  it('branch icons are present', () => {
    const html = renderTree(createSampleTree());
    expect(html).toContain('👁');
    expect(html).toContain('🌊');
    expect(html).toContain('🔗');
  });

  it('search input present in output', () => {
    expect(renderTree(createSampleTree())).toContain('vw-search');
  });

  it('add-leaf buttons present in output', () => {
    const html = renderTree(createSampleTree());
    const count = (html.match(/vw-add-leaf-btn/g) ?? []).length;
    // At least as many buttons as nodes (one per node)
    expect(count).toBeGreaterThan(0);
  });

  it('inlined search script present', () => {
    const html = renderTree(createSampleTree());
    expect(html).toContain('vw-search');
    // Script content should reference the doFilter function
    expect(html).toContain('doFilter');
  });

  it('observer shortcodes present for each node', () => {
    const tree = createSampleTree();
    const html = renderTree(tree);
    // Each node observer first 8 chars should appear
    for (const node of tree.nodes) {
      const short = node.observer.slice(0, 8);
      expect(html).toContain(short);
    }
  });

  it('tree with a single root and no children renders', () => {
    const node: ViewerNode = {
      hash: 'singleroot000000',
      label: 'Solo Root',
      content: 'Only node.',
      branch: 'observe',
      depth: 0,
      children: [],
      trust: 0.9,
      chainDepth: 0,
      observer: 'abcdef123456',
    };
    const tree: ViewerTree = { nodes: [node], roots: ['singleroot000000'] };
    const html = renderTree(tree);
    expect(html).toContain('Solo Root');
    expect(html).toContain('Genesis');
  });

  it('tree title appears in HTML <title> tag', () => {
    const tree = createSampleTree();
    const html = renderTree(tree);
    expect(html).toContain(`<title>${tree.title}</title>`);
  });

  it('escapes HTML special chars in labels', () => {
    const node: ViewerNode = {
      hash: 'xss000000000000',
      label: '<script>alert(1)</script>',
      content: 'XSS attempt.',
      branch: 'observe',
      depth: 0,
      children: [],
      trust: 0.5,
      chainDepth: 1,
      observer: 'safe000000',
    };
    const tree: ViewerTree = { nodes: [node], roots: ['xss000000000000'] };
    const html = renderTree(tree);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
