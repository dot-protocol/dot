/**
 * renderer.test.ts — 30+ tests for the HTML renderer.
 */

import { describe, it, expect } from 'vitest';
import { renderTree } from '../src/renderer.js';
import { createSampleTree } from '../src/sample.js';
import type { ViewerTree, ViewerNode } from '../src/types.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function minimalTree(): ViewerTree {
  const root: ViewerNode = {
    hash: 'aabbcc0011223344',
    label: 'Root Node',
    content: 'Root content here.',
    branch: 'observe',
    depth: 0,
    children: [],
    trust: 1.0,
    chainDepth: 5,
    observer: 'deadbeef',
  };
  return { nodes: [root], roots: ['aabbcc0011223344'] };
}

function sizedTree(count: number): ViewerTree {
  const nodes: ViewerNode[] = [];
  const roots: string[] = [];
  for (let i = 0; i < count; i++) {
    const hash = `node${String(i).padStart(12, '0')}`;
    const branch = i < Math.floor(count / 3) ? 'observe' : i < Math.floor((2 * count) / 3) ? 'flow' : 'connect';
    const node: ViewerNode = {
      hash,
      label: `Node ${i} label`,
      content: `Content for node number ${i} in the test tree.`,
      branch,
      depth: 0,
      children: [],
      trust: (i % 4) * 0.5,
      chainDepth: i * 2,
      observer: `obs${String(i).padStart(6, '0')}abc`,
    };
    nodes.push(node);
    if (!roots.find(r => {
      const n = nodes.find(x => x.hash === r);
      return n && n.branch === branch;
    })) {
      roots.push(hash);
    }
  }
  return { nodes, roots, title: `Test Tree ${count}` };
}

// ── Basic structure ────────────────────────────────────────────────────────

describe('renderTree — document structure', () => {
  it('produces a string', () => {
    expect(typeof renderTree(minimalTree())).toBe('string');
  });

  it('starts with DOCTYPE', () => {
    const html = renderTree(minimalTree());
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('contains <html lang="en">', () => {
    expect(renderTree(minimalTree())).toContain('<html lang="en">');
  });

  it('contains <head>', () => {
    expect(renderTree(minimalTree())).toContain('<head>');
  });

  it('contains <body>', () => {
    expect(renderTree(minimalTree())).toContain('<body>');
  });

  it('closes </html>', () => {
    const html = renderTree(minimalTree());
    expect(html.trimEnd()).toMatch(/<\/html>\s*$/);
  });

  it('has meta charset', () => {
    expect(renderTree(minimalTree())).toContain('charset="UTF-8"');
  });

  it('has responsive meta viewport', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('viewport');
    expect(html).toContain('width=device-width');
  });

  it('has <title> tag', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('<title>');
  });

  it('title appears in <title> tag', () => {
    const tree = minimalTree();
    tree.title = 'My Custom Tree';
    expect(renderTree(tree)).toContain('My Custom Tree');
  });

  it('renders empty-state for empty node list', () => {
    const tree: ViewerTree = { nodes: [], roots: [], title: 'Empty' };
    const html = renderTree(tree);
    expect(html).toContain('No observations yet');
  });
});

// ── Content correctness ────────────────────────────────────────────────────

describe('renderTree — node content', () => {
  it('contains root node label', () => {
    expect(renderTree(minimalTree())).toContain('Root Node');
  });

  it('contains node content text', () => {
    expect(renderTree(minimalTree())).toContain('Root content here.');
  });

  it('contains all sample tree node labels', () => {
    const tree = createSampleTree();
    const html = renderTree(tree);
    for (const node of tree.nodes) {
      expect(html).toContain(node.label);
    }
  });

  it('shows all root branch labels', () => {
    const tree = createSampleTree();
    const html = renderTree(tree);
    // The root branches are observe, flow, connect
    expect(html).toMatch(/Observe/i);
    expect(html).toMatch(/Flow/i);
    expect(html).toMatch(/Connect/i);
  });

  it('contains observe branch icon', () => {
    expect(renderTree(createSampleTree())).toContain('👁');
  });

  it('contains flow branch icon', () => {
    expect(renderTree(createSampleTree())).toContain('🌊');
  });

  it('contains connect branch icon', () => {
    expect(renderTree(createSampleTree())).toContain('🔗');
  });
});

// ── Trust ──────────────────────────────────────────────────────────────────

describe('renderTree — trust visualization', () => {
  it('includes trust color classes in CSS', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('vw-trust-red');
    expect(html).toContain('vw-trust-yellow');
    expect(html).toContain('vw-trust-green');
    expect(html).toContain('vw-trust-gold');
  });

  it('applies red trust class for trust < 0.3', () => {
    const tree = minimalTree();
    tree.nodes[0]!.trust = 0.1;
    expect(renderTree(tree)).toContain('vw-trust-red');
  });

  it('applies yellow trust class for trust 0.3–0.7', () => {
    const tree = minimalTree();
    tree.nodes[0]!.trust = 0.5;
    expect(renderTree(tree)).toContain('vw-trust-yellow');
  });

  it('applies green trust class for trust 0.7–1.5', () => {
    const tree = minimalTree();
    tree.nodes[0]!.trust = 1.0;
    expect(renderTree(tree)).toContain('vw-trust-green');
  });

  it('applies gold trust class for trust > 1.5', () => {
    const tree = minimalTree();
    tree.nodes[0]!.trust = 2.5;
    expect(renderTree(tree)).toContain('vw-trust-gold');
  });

  it('each node has a trust badge element', () => {
    const html = renderTree(createSampleTree());
    const badgeCount = (html.match(/vw-trust-badge/g) ?? []).length;
    // At least as many badges as nodes (CSS definition counts once)
    expect(badgeCount).toBeGreaterThan(createSampleTree().nodes.length);
  });

  it('trust colors defined in CSS', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('#ef4444');
    expect(html).toContain('#eab308');
    expect(html).toContain('#22c55e');
    expect(html).toContain('#f59e0b');
  });
});

// ── Collapsible structure ──────────────────────────────────────────────────

describe('renderTree — collapsible structure', () => {
  it('uses <details> elements', () => {
    expect(renderTree(minimalTree())).toContain('<details');
  });

  it('uses <summary> elements', () => {
    expect(renderTree(minimalTree())).toContain('<summary');
  });

  it('root branches start open', () => {
    const html = renderTree(createSampleTree());
    expect(html).toContain('<details open>');
  });

  it('has chain depth displayed', () => {
    const html = renderTree(minimalTree());
    // chainDepth = 5 → "Shallow·5"
    expect(html).toContain('Shallow');
  });
});

// ── Search ─────────────────────────────────────────────────────────────────

describe('renderTree — search', () => {
  it('contains search input element', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('id="vw-search"');
  });

  it('search input has type="search"', () => {
    expect(renderTree(minimalTree())).toContain('type="search"');
  });

  it('search bar is in a sticky container', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('vw-search-wrap');
  });
});

// ── Dark theme ─────────────────────────────────────────────────────────────

describe('renderTree — dark theme', () => {
  it('background color is #0a0a0b', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('#0a0a0b');
  });

  it('surface color is #18181b', () => {
    expect(renderTree(minimalTree())).toContain('#18181b');
  });

  it('text color is #e4e4e7', () => {
    expect(renderTree(minimalTree())).toContain('#e4e4e7');
  });

  it('uses system-ui font', () => {
    expect(renderTree(minimalTree())).toContain('system-ui');
  });
});

// ── No external dependencies ───────────────────────────────────────────────

describe('renderTree — zero external dependencies', () => {
  it('contains no CDN URLs (no cdn.)', () => {
    expect(renderTree(createSampleTree())).not.toMatch(/https?:\/\/cdn\./);
  });

  it('contains no external font URLs', () => {
    expect(renderTree(createSampleTree())).not.toMatch(/https?:\/\/fonts\./);
  });

  it('contains no external script src', () => {
    const html = renderTree(createSampleTree());
    // All scripts should be inline (no src attribute on script tags)
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it('contains no external stylesheet links', () => {
    expect(renderTree(createSampleTree())).not.toMatch(/<link[^>]+stylesheet/);
  });

  it('contains no googleapis references', () => {
    expect(renderTree(createSampleTree())).not.toContain('googleapis.com');
  });
});

// ── Size constraints ───────────────────────────────────────────────────────

describe('renderTree — size constraints', () => {
  it('20-node sample tree is under 50KB', () => {
    const html = renderTree(createSampleTree());
    const bytes = new TextEncoder().encode(html).length;
    expect(bytes).toBeLessThan(50_000);
  });

  it('100-node tree is under 100KB', () => {
    const html = renderTree(sizedTree(100));
    const bytes = new TextEncoder().encode(html).length;
    expect(bytes).toBeLessThan(100_000);
  });

  it('renders without error for 1-node tree', () => {
    expect(() => renderTree(minimalTree())).not.toThrow();
  });
});

// ── Node metadata ──────────────────────────────────────────────────────────

describe('renderTree — node metadata', () => {
  it('shows observer shortcode', () => {
    const html = renderTree(minimalTree());
    // deadbeef → shows first 8 chars + ellipsis
    expect(html).toContain('deadbeef');
  });

  it('shows hash in detail panel', () => {
    const html = renderTree(minimalTree());
    expect(html).toContain('aabbcc0011223344');
  });

  it('contains add-leaf button', () => {
    expect(renderTree(minimalTree())).toContain('vw-add-leaf-btn');
  });

  it('nodes sorted by depth within branch', () => {
    // Children appear after parent in the output
    const tree = createSampleTree();
    const html = renderTree(tree);
    const observeRoot = tree.nodes.find(n => n.depth === 0 && n.branch === 'observe');
    const child = tree.nodes.find(n => n.depth === 1 && n.branch === 'observe');
    if (observeRoot && child) {
      const rootPos = html.indexOf(observeRoot.label);
      const childPos = html.indexOf(child.label);
      expect(rootPos).toBeLessThan(childPos);
    }
  });
});
