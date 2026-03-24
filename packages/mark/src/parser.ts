/**
 * parser.ts — DOT-MARK syntax parser.
 *
 * DOT-MARK extends the DOT observation language with `page` declarations and
 * `render {}` blocks. The parser reads DOT-MARK source and produces a DotMarkAST.
 *
 * Syntax:
 *   page "Title" {
 *     observe [type:] name at location
 *       render { display: "gauge", range: [0, 100], unit: "C", trust: "show" }
 *     observe state: reactor_status
 *       render { display: "badge", colors: { active: "green", shutdown: "red" } }
 *   }
 *
 * A render block is optional — elements without one use default display.
 * Pages are optional — bare observe statements outside any page are collected
 * into an implicit unnamed page.
 */

/**
 * An observe node parsed from DOT-MARK source.
 * Mirrors ObserveStatement from @dot-protocol/lang but simplified for rendering.
 */
export interface ObserveNode {
  /** Observation type keyword: measure, state, event, claim, bond, or undefined */
  observationType?: string;
  /** Optional name identifier */
  name?: string;
  /** Location string (after `at`) */
  location?: string;
  /** Raw value string (after `=`) */
  value?: string;
}

/** Render directive extracted from a `render { ... }` block. */
export interface RenderDirective {
  /** Display type: gauge, badge, text, number, list, chart */
  display: string;
  /** Arbitrary key-value render props */
  props: Record<string, unknown>;
}

/** An element: one observe statement with optional render directive. */
export interface ElementNode {
  observe: ObserveNode;
  render?: RenderDirective;
}

/** A page: a named collection of elements. */
export interface PageNode {
  title: string;
  elements: ElementNode[];
}

/** The top-level DOT-MARK AST. */
export interface DotMarkAST {
  pages: PageNode[];
}

// ---------------------------------------------------------------------------
// Parser implementation
// ---------------------------------------------------------------------------

/** Tokenizer state */
interface State {
  src: string;
  pos: number;
  lines: string[];
  line: number;
}

/**
 * Parse DOT-MARK source into a DotMarkAST.
 *
 * @param source - DOT-MARK source string
 * @returns DotMarkAST
 */
export function parseDotMark(source: string): DotMarkAST {
  const lines = source.split('\n');
  const s: State = { src: source, pos: 0, lines, line: 0 };
  const pages: PageNode[] = [];
  const implicitElements: ElementNode[] = [];

  while (s.line < s.lines.length) {
    const line = s.lines[s.line] ?? '';
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      s.line++;
      continue;
    }

    if (trimmed.startsWith('page ')) {
      const page = parsePage(s);
      pages.push(page);
    } else if (trimmed.startsWith('observe')) {
      const elem = parseElement(s);
      if (elem) implicitElements.push(elem);
    } else {
      s.line++;
    }
  }

  // Collect implicit elements into unnamed page if any
  if (implicitElements.length > 0) {
    pages.unshift({ title: '', elements: implicitElements });
  }

  return { pages };
}

// ---------------------------------------------------------------------------
// Page parsing
// ---------------------------------------------------------------------------

function parsePage(s: State): PageNode {
  const headerLine = s.lines[s.line] ?? '';
  const title = extractQuotedString(headerLine) ?? '';
  s.line++;

  // If the opening brace was on the page header line (e.g. `page "X" {`), we're
  // already inside the block. Otherwise skip lines until we find the `{`.
  if (!headerLine.includes('{')) {
    while (s.line < s.lines.length) {
      const l = s.lines[s.line] ?? '';
      s.line++;
      if (l.includes('{')) break;
    }
  }
  // else: brace was on the header line — body starts at s.line (already incremented)

  const elements: ElementNode[] = [];

  while (s.line < s.lines.length) {
    const line = s.lines[s.line] ?? '';
    const trimmed = line.trim();

    if (trimmed === '}') { s.line++; break; }
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      s.line++;
      continue;
    }

    if (trimmed.startsWith('observe')) {
      const elem = parseElement(s);
      if (elem) elements.push(elem);
    } else {
      s.line++;
    }
  }

  return { title, elements };
}

// ---------------------------------------------------------------------------
// Element parsing
// ---------------------------------------------------------------------------

function parseElement(s: State): ElementNode | null {
  const observeLine = s.lines[s.line] ?? '';
  s.line++;

  const observe = parseObserveLine(observeLine);

  // Look ahead for render block on the next non-empty line
  let render: RenderDirective | undefined;

  // Peek at next line
  let nextLineIdx = s.line;
  while (nextLineIdx < s.lines.length) {
    const next = (s.lines[nextLineIdx] ?? '').trim();
    if (next === '') { nextLineIdx++; continue; }
    if (next.startsWith('render')) {
      s.line = nextLineIdx + 1;
      render = parseRenderBlock(s, next);
    }
    break;
  }

  return { observe, render };
}

/** Parse `observe [type:] [name] [at location] [= value]` */
function parseObserveLine(line: string): ObserveNode {
  // Remove leading 'observe'
  let rest = line.trim().replace(/^observe\s*/, '');

  let observationType: string | undefined;
  let name: string | undefined;
  let location: string | undefined;
  let value: string | undefined;

  const obsTypes = ['measure', 'state', 'event', 'claim', 'bond', 'plain'];

  // Check for type annotation: "type:" or just type keyword
  for (const t of obsTypes) {
    if (rest.startsWith(t + ':')) {
      observationType = t;
      rest = rest.slice(t.length + 1).trim();
      break;
    }
    if (rest === t || rest.startsWith(t + ' ')) {
      observationType = t;
      rest = rest.slice(t.length).trim();
      break;
    }
  }

  // Extract value after '='
  const eqIdx = rest.indexOf('=');
  if (eqIdx !== -1) {
    // Check it's not part of >=, <=, ==
    if (eqIdx === 0 || (rest[eqIdx - 1] !== '>' && rest[eqIdx - 1] !== '<' && rest[eqIdx - 1] !== '!')) {
      value = rest.slice(eqIdx + 1).trim();
      rest = rest.slice(0, eqIdx).trim();
    }
  }

  // Extract location after 'at'
  const atMatch = rest.match(/^(.*?)\bat\b\s+(.+)$/);
  if (atMatch) {
    rest = (atMatch[1] ?? '').trim();
    location = (atMatch[2] ?? '').trim();
  }

  // Remaining is the name
  if (rest.trim()) {
    name = rest.trim();
  }

  return { observationType, name, location, value };
}

// ---------------------------------------------------------------------------
// Render block parsing
// ---------------------------------------------------------------------------

/**
 * Parse a render block. Handles both single-line and multi-line forms:
 *   render { display: "gauge", range: [0, 100] }
 *   render {
 *     display: "gauge"
 *     range: [0, 100]
 *   }
 */
function parseRenderBlock(s: State, firstLine: string): RenderDirective {
  // Collect the full block content
  let blockContent = '';
  const inlineMatch = firstLine.match(/render\s*\{([\s\S]*)\}/);

  if (inlineMatch) {
    // Single-line: render { ... }
    blockContent = inlineMatch[1] ?? '';
  } else {
    // Multi-line: render { \n ... \n }
    // firstLine contains "render {" — collect until matching "}"
    let depth = (firstLine.match(/\{/g) ?? []).length - (firstLine.match(/\}/g) ?? []).length;
    blockContent = firstLine.replace(/^.*?render\s*\{/, '');

    while (s.line < s.lines.length && depth > 0) {
      const l = s.lines[s.line] ?? '';
      s.line++;
      depth += (l.match(/\{/g) ?? []).length;
      depth -= (l.match(/\}/g) ?? []).length;
      if (depth >= 0) {
        blockContent += '\n' + l;
      } else {
        // This line closes the block
        blockContent += '\n' + l.replace(/}[^}]*$/, '');
      }
    }
  }

  return parseRenderProps(blockContent.trim());
}

/**
 * Parse render properties from the inside of a render block.
 * Supports: display, range, unit, trust, colors, label, min, max
 */
function parseRenderProps(content: string): RenderDirective {
  const props: Record<string, unknown> = {};
  let display = 'text';

  // Split on commas that are not inside brackets/braces
  const pairs = splitProps(content);

  for (const pair of pairs) {
    const colonIdx = pair.indexOf(':');
    if (colonIdx === -1) continue;
    const key = pair.slice(0, colonIdx).trim();
    const rawVal = pair.slice(colonIdx + 1).trim();

    if (key === 'display') {
      display = parseStringValue(rawVal) ?? 'text';
    } else if (key === 'range') {
      props['range'] = parseArrayValue(rawVal);
    } else if (key === 'colors') {
      props['colors'] = parseObjectValue(rawVal);
    } else if (key === 'trust') {
      props['trust'] = parseStringValue(rawVal) ?? rawVal;
    } else if (key === 'unit') {
      props['unit'] = parseStringValue(rawVal) ?? rawVal;
    } else if (key === 'min') {
      props['min'] = parseNumberValue(rawVal);
    } else if (key === 'max') {
      props['max'] = parseNumberValue(rawVal);
    } else if (key === 'label') {
      props['label'] = parseStringValue(rawVal) ?? rawVal;
    } else {
      // Store as-is
      props[key] = parseStringValue(rawVal) ?? rawVal;
    }
  }

  return { display, props };
}

// ---------------------------------------------------------------------------
// Value parsers
// ---------------------------------------------------------------------------

function parseStringValue(s: string): string | undefined {
  const trimmed = s.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return undefined;
}

function parseNumberValue(s: string): number {
  return parseFloat(s.trim());
}

function parseArrayValue(s: string): number[] {
  const trimmed = s.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map(v => parseFloat(v.trim()))
      .filter(v => !isNaN(v));
  }
  return [];
}

function parseObjectValue(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  const trimmed = s.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1);
    const pairs = inner.split(',');
    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) continue;
      const k = pair.slice(0, colonIdx).trim().replace(/['"]/g, '');
      const v = pair.slice(colonIdx + 1).trim().replace(/['"]/g, '');
      if (k) result[k] = v;
    }
  }
  return result;
}

/**
 * Split a props string on commas that are not inside [] or {} nesting.
 */
function splitProps(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of content) {
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Extract the first double-quoted string from a line. */
function extractQuotedString(line: string): string | undefined {
  const m = line.match(/"([^"]*)"/);
  return m ? m[1] : undefined;
}
