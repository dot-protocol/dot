/**
 * Parser tests for @dot-protocol/mark — R854.
 * 30+ tests covering DOT-MARK page/observe/render syntax.
 */

import { describe, it, expect } from 'vitest';
import { parseDotMark } from '../src/parser.js';
import type { DotMarkAST, PageNode, ElementNode } from '../src/parser.js';

// Helpers
function firstPage(src: string): PageNode {
  return parseDotMark(src).pages[0]!;
}
function firstElement(src: string): ElementNode {
  return firstPage(src).elements[0]!;
}

// ---------------------------------------------------------------------------
// Page declarations
// ---------------------------------------------------------------------------

describe('page declaration', () => {
  it('parses a page with a quoted title', () => {
    const ast = parseDotMark(`page "Dashboard" {\n  observe state: reactor\n}`);
    expect(ast.pages[0]?.title).toBe('Dashboard');
  });

  it('parses multiple pages', () => {
    const src = `page "Alpha" {\n  observe state: a\n}\npage "Beta" {\n  observe state: b\n}`;
    const ast = parseDotMark(src);
    expect(ast.pages).toHaveLength(2);
    expect(ast.pages[0]?.title).toBe('Alpha');
    expect(ast.pages[1]?.title).toBe('Beta');
  });

  it('page with no title uses empty string', () => {
    const ast = parseDotMark(`page "" {\n  observe state: x\n}`);
    expect(ast.pages[0]?.title).toBe('');
  });

  it('page with elements collects them all', () => {
    const src = `page "Test" {\n  observe measure: temp\n  observe state: status\n  observe event: alert\n}`;
    const ast = parseDotMark(src);
    expect(ast.pages[0]?.elements).toHaveLength(3);
  });

  it('empty page has no elements', () => {
    const ast = parseDotMark(`page "Empty" {\n}`);
    expect(ast.pages[0]?.elements).toHaveLength(0);
  });

  it('bare observe outside a page creates implicit page', () => {
    const ast = parseDotMark(`observe state: x`);
    expect(ast.pages).toHaveLength(1);
    expect(ast.pages[0]?.elements).toHaveLength(1);
  });

  it('comments and blank lines are ignored inside page', () => {
    const src = `page "Clean" {\n\n  # a comment\n  observe state: val\n\n}`;
    const ast = parseDotMark(src);
    expect(ast.pages[0]?.elements).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// observe statement
// ---------------------------------------------------------------------------

describe('observe statement', () => {
  it('parses observe with type annotation (colon form)', () => {
    const e = firstElement(`page "P" {\n  observe measure: temperature\n}`);
    expect(e.observe.observationType).toBe('measure');
    expect(e.observe.name).toBe('temperature');
  });

  it('parses observe state:', () => {
    const e = firstElement(`page "P" {\n  observe state: reactor_status\n}`);
    expect(e.observe.observationType).toBe('state');
  });

  it('parses observe event:', () => {
    const e = firstElement(`page "P" {\n  observe event: door_open\n}`);
    expect(e.observe.observationType).toBe('event');
  });

  it('parses observe claim:', () => {
    const e = firstElement(`page "P" {\n  observe claim: identity_verified\n}`);
    expect(e.observe.observationType).toBe('claim');
  });

  it('parses observe bond:', () => {
    const e = firstElement(`page "P" {\n  observe bond: sensor_link\n}`);
    expect(e.observe.observationType).toBe('bond');
  });

  it('parses observe without type annotation', () => {
    const e = firstElement(`page "P" {\n  observe temperature\n}`);
    expect(e.observe.observationType).toBeUndefined();
    expect(e.observe.name).toBe('temperature');
  });

  it('parses observe with at location', () => {
    const e = firstElement(`page "P" {\n  observe measure: temperature at sensor_7\n}`);
    expect(e.observe.location).toBe('sensor_7');
  });

  it('parses observe with = value', () => {
    const e = firstElement(`page "P" {\n  observe state: mode = active\n}`);
    expect(e.observe.value).toBe('active');
  });

  it('observe missing type has undefined observationType', () => {
    const e = firstElement(`page "P" {\n  observe thing\n}`);
    expect(e.observe.observationType).toBeUndefined();
    expect(e.observe.name).toBe('thing');
  });
});

// ---------------------------------------------------------------------------
// render block
// ---------------------------------------------------------------------------

describe('render block', () => {
  it('parses render with display type', () => {
    const src = `page "P" {\n  observe measure: temp\n    render { display: "gauge" }\n}`;
    const e = firstElement(src);
    expect(e.render?.display).toBe('gauge');
  });

  it('parses render with range array', () => {
    const src = `page "P" {\n  observe measure: temp\n    render { display: "gauge", range: [0, 100] }\n}`;
    const e = firstElement(src);
    expect(e.render?.props['range']).toEqual([0, 100]);
  });

  it('parses render with unit', () => {
    const src = `page "P" {\n  observe measure: temp\n    render { display: "gauge", unit: "C" }\n}`;
    const e = firstElement(src);
    expect(e.render?.props['unit']).toBe('C');
  });

  it('parses render with trust: "show"', () => {
    const src = `page "P" {\n  observe measure: temp\n    render { display: "gauge", trust: "show" }\n}`;
    const e = firstElement(src);
    expect(e.render?.props['trust']).toBe('show');
  });

  it('parses render badge with colors object', () => {
    const src = `page "P" {\n  observe state: status\n    render { display: "badge", colors: { active: "green", shutdown: "red" } }\n}`;
    const e = firstElement(src);
    expect(e.render?.display).toBe('badge');
    const colors = e.render?.props['colors'] as Record<string, string>;
    expect(colors['active']).toBe('green');
    expect(colors['shutdown']).toBe('red');
  });

  it('element without render block has undefined render', () => {
    const e = firstElement(`page "P" {\n  observe state: x\n}`);
    expect(e.render).toBeUndefined();
  });

  it('parses display: "text"', () => {
    const src = `page "P" {\n  observe claim: note\n    render { display: "text" }\n}`;
    const e = firstElement(src);
    expect(e.render?.display).toBe('text');
  });

  it('parses display: "number"', () => {
    const src = `page "P" {\n  observe measure: count\n    render { display: "number" }\n}`;
    const e = firstElement(src);
    expect(e.render?.display).toBe('number');
  });

  it('parses display: "list"', () => {
    const src = `page "P" {\n  observe claim: items\n    render { display: "list" }\n}`;
    const e = firstElement(src);
    expect(e.render?.display).toBe('list');
  });

  it('parses display: "chart"', () => {
    const src = `page "P" {\n  observe measure: history\n    render { display: "chart" }\n}`;
    const e = firstElement(src);
    expect(e.render?.display).toBe('chart');
  });

  it('multiple elements with different render types', () => {
    const src = `page "P" {
  observe measure: temp
    render { display: "gauge", range: [0, 100], unit: "C" }
  observe state: status
    render { display: "badge", colors: { active: "green" } }
  observe claim: note
    render { display: "text" }
}`;
    const page = firstPage(src);
    expect(page.elements).toHaveLength(3);
    expect(page.elements[0]?.render?.display).toBe('gauge');
    expect(page.elements[1]?.render?.display).toBe('badge');
    expect(page.elements[2]?.render?.display).toBe('text');
  });

  it('missing render defaults to undefined, not "text"', () => {
    const e = firstElement(`page "P" {\n  observe state: x\n}`);
    expect(e.render).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AST structure
// ---------------------------------------------------------------------------

describe('AST structure', () => {
  it('empty source returns empty pages array', () => {
    const ast = parseDotMark('');
    expect(ast.pages).toHaveLength(0);
  });

  it('whitespace-only source returns empty pages', () => {
    const ast = parseDotMark('   \n\n  \n');
    expect(ast.pages).toHaveLength(0);
  });

  it('returns DotMarkAST shape', () => {
    const ast = parseDotMark(`page "P" {\n  observe state: x\n}`);
    expect(ast).toHaveProperty('pages');
    expect(Array.isArray(ast.pages)).toBe(true);
  });
});
