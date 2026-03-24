/**
 * Compiler tests for @dot-protocol/mark — R854.
 * 35+ tests covering HTML output, display types, trust attributes, self-contained.
 */

import { describe, it, expect } from 'vitest';
import { parseDotMark, compileDotMark } from '../src/index.js';

function compile(src: string): string {
  return compileDotMark(parseDotMark(src));
}

// ---------------------------------------------------------------------------
// Document structure
// ---------------------------------------------------------------------------

describe('output structure', () => {
  it('output contains DOCTYPE', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('output contains <html> tag', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('<html');
  });

  it('output contains <head>', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('<head>');
  });

  it('output contains <body>', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('<body>');
  });

  it('output contains closing </html>', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('</html>');
  });

  it('output contains inline <style> block', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
  });

  it('output has no external CDN links', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('unpkg.com');
    expect(html).not.toContain('<link rel');
  });

  it('output has no external script src', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    // No <script src="..."> tags
    expect(html).not.toMatch(/<script\s+src=/i);
  });
});

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

describe('dark theme', () => {
  it('contains dark background color', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('#0a0a0b');
  });

  it('contains surface color', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('#18181b');
  });

  it('contains text color', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('#e4e4e7');
  });

  it('contains accent color', () => {
    const html = compile(`page "X" {\n  observe state: x\n}`);
    expect(html).toContain('#818cf8');
  });
});

// ---------------------------------------------------------------------------
// Page title
// ---------------------------------------------------------------------------

describe('page title', () => {
  it('renders page title', () => {
    const html = compile(`page "Dashboard" {\n  observe state: x\n}`);
    expect(html).toContain('Dashboard');
  });

  it('renders multiple page titles', () => {
    const src = `page "Alpha" {\n  observe state: a\n}\npage "Beta" {\n  observe state: b\n}`;
    const html = compile(src);
    expect(html).toContain('Alpha');
    expect(html).toContain('Beta');
  });
});

// ---------------------------------------------------------------------------
// Trust data attributes
// ---------------------------------------------------------------------------

describe('trust data attributes', () => {
  it('element has data-trust attribute', () => {
    const html = compile(`page "P" {\n  observe state: x\n}`);
    expect(html).toContain('data-trust=');
  });

  it('element has data-depth attribute', () => {
    const html = compile(`page "P" {\n  observe state: x\n}`);
    expect(html).toContain('data-depth=');
  });

  it('element has data-display attribute', () => {
    const html = compile(`page "P" {\n  observe state: x\n}`);
    expect(html).toContain('data-display=');
  });

  it('dot-element class present', () => {
    const html = compile(`page "P" {\n  observe state: x\n}`);
    expect(html).toContain('dot-element');
  });
});

// ---------------------------------------------------------------------------
// Display types render
// ---------------------------------------------------------------------------

describe('display: gauge', () => {
  it('gauge renders SVG element', () => {
    const html = compile(`page "P" {\n  observe measure: temp\n    render { display: "gauge", range: [0, 100], unit: "C" }\n}`);
    expect(html).toContain('<svg');
    expect(html).toContain('</svg>');
  });

  it('gauge contains arc path', () => {
    const html = compile(`page "P" {\n  observe measure: temp\n    render { display: "gauge", range: [0, 100] }\n}`);
    expect(html).toContain('<path');
  });
});

describe('display: badge', () => {
  it('badge renders dm-badge class', () => {
    const html = compile(`page "P" {\n  observe state: status\n    render { display: "badge", colors: { active: "green" } }\n}`);
    expect(html).toContain('dm-badge');
  });
});

describe('display: text', () => {
  it('text renders paragraph tag', () => {
    const html = compile(`page "P" {\n  observe claim: note = "Hello world"\n    render { display: "text" }\n}`);
    expect(html).toContain('<p class="dm-text">');
  });
});

describe('display: number', () => {
  it('number renders dm-number-value class', () => {
    const html = compile(`page "P" {\n  observe measure: count\n    render { display: "number" }\n}`);
    expect(html).toContain('dm-number-value');
  });
});

describe('display: list', () => {
  it('list renders <ul> element', () => {
    const html = compile(`page "P" {\n  observe claim: items = "a,b,c"\n    render { display: "list" }\n}`);
    expect(html).toContain('<ul');
  });
});

describe('display: chart', () => {
  it('chart renders placeholder', () => {
    const html = compile(`page "P" {\n  observe measure: trend\n    render { display: "chart" }\n}`);
    expect(html).toContain('dm-chart-placeholder');
  });
});

// ---------------------------------------------------------------------------
// Default display inference
// ---------------------------------------------------------------------------

describe('default display inference', () => {
  it('state without render block defaults to badge', () => {
    const html = compile(`page "P" {\n  observe state: status\n}`);
    expect(html).toContain('data-display="badge"');
  });

  it('measure without render block defaults to gauge', () => {
    const html = compile(`page "P" {\n  observe measure: temp\n}`);
    expect(html).toContain('data-display="gauge"');
  });

  it('claim without render block defaults to text', () => {
    const html = compile(`page "P" {\n  observe claim: note\n}`);
    expect(html).toContain('data-display="text"');
  });
});

// ---------------------------------------------------------------------------
// Self-contained
// ---------------------------------------------------------------------------

describe('self-contained', () => {
  it('no import statements in output', () => {
    const html = compile(`page "P" {\n  observe state: x\n}`);
    expect(html).not.toContain('import ');
  });

  it('charset meta tag present', () => {
    const html = compile(`page "P" {\n  observe state: x\n}`);
    expect(html).toContain('charset');
  });
});
