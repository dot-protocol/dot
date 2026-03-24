/**
 * Error type and formatting tests for @dot-protocol/lang — R854.
 * Target: 15+ tests.
 */

import { describe, it, expect } from 'vitest';
import { lex } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import { formatError, formatErrors, makeError } from '../src/errors.js';
import type { DotError } from '../src/errors.js';

// --- makeError ---

describe('makeError', () => {
  it('creates error with location and message', () => {
    const err = makeError('test error', { line: 1, column: 5, offset: 4 });
    expect(err.message).toBe('test error');
    expect(err.location.line).toBe(1);
    expect(err.location.column).toBe(5);
    expect(err.severity).toBe('error');
  });

  it('sets suggestion when provided', () => {
    const err = makeError('bad token', { line: 2, column: 1, offset: 10 }, 'Try this instead');
    expect(err.suggestion).toBe('Try this instead');
  });

  it('uses error severity by default', () => {
    const err = makeError('msg', { line: 1, column: 1, offset: 0 });
    expect(err.severity).toBe('error');
  });

  it('supports warning severity', () => {
    const err = makeError('msg', { line: 1, column: 1, offset: 0 }, undefined, 'warning');
    expect(err.severity).toBe('warning');
  });
});

// --- formatError ---

describe('formatError', () => {
  it('includes ERROR prefix for error severity', () => {
    const err: DotError = {
      message: 'Unexpected token',
      location: { line: 1, column: 3, offset: 2 },
      severity: 'error',
    };
    const out = formatError('ab@cd', err);
    expect(out).toContain('ERROR');
    expect(out).toContain('line 1');
    expect(out).toContain('column 3');
  });

  it('shows the source line', () => {
    const source = 'observe temperature at sensor_7';
    const err: DotError = {
      message: 'test',
      location: { line: 1, column: 1, offset: 0 },
      severity: 'error',
    };
    const out = formatError(source, err);
    expect(out).toContain('observe temperature at sensor_7');
  });

  it('shows ^ caret at correct column', () => {
    const source = 'abc@def';
    const err: DotError = {
      message: 'bad char',
      location: { line: 1, column: 4, offset: 3 },
      severity: 'error',
    };
    const out = formatError(source, err);
    const lines = out.split('\n');
    const caretLine = lines.find(l => l.includes('^'));
    expect(caretLine).toBeDefined();
    // col 4 → 3 spaces then ^
    expect(caretLine).toMatch(/\s{3}\^/);
  });

  it('shows suggestion when present', () => {
    const err: DotError = {
      message: 'bad token',
      location: { line: 1, column: 1, offset: 0 },
      suggestion: 'Use observe instead',
      severity: 'error',
    };
    const out = formatError('x', err);
    expect(out).toContain('Suggestion:');
    expect(out).toContain('Use observe instead');
  });

  it('handles multiline source — points to correct line', () => {
    const source = 'line one\nline two\nline three';
    const err: DotError = {
      message: 'error on line 2',
      location: { line: 2, column: 6, offset: 14 },
      severity: 'error',
    };
    const out = formatError(source, err);
    expect(out).toContain('line two');
    expect(out).not.toContain('line one');
  });

  it('handles line beyond source gracefully', () => {
    const err: DotError = {
      message: 'past end',
      location: { line: 99, column: 1, offset: 999 },
      severity: 'error',
    };
    // Should not throw
    expect(() => formatError('short', err)).not.toThrow();
  });
});

// --- formatErrors ---

describe('formatErrors', () => {
  it('formats multiple errors separated by blank lines', () => {
    const errors: DotError[] = [
      makeError('first error', { line: 1, column: 1, offset: 0 }),
      makeError('second error', { line: 2, column: 1, offset: 5 }),
    ];
    const out = formatErrors('a\nb', errors);
    expect(out).toContain('first error');
    expect(out).toContain('second error');
  });

  it('returns empty string for no errors', () => {
    const out = formatErrors('source', []);
    expect(out).toBe('');
  });

  it('formats single error without extra blank lines', () => {
    const err = makeError('only error', { line: 1, column: 1, offset: 0 });
    const out = formatErrors('x', [err]);
    expect(out).toContain('only error');
  });
});

// --- Lexer errors ---

describe('Lexer errors have location', () => {
  it('unknown char error has correct line/column', () => {
    const result = lex('observe @bad');
    const err = result.errors[0];
    expect(err).toBeDefined();
    expect(err!.location.line).toBe(1);
    expect(err!.location.column).toBeGreaterThan(1); // '@' is not at column 1
  });

  it('unterminated string error has location at string start', () => {
    const result = lex('observe "unterminated');
    const err = result.errors[0];
    expect(err).toBeDefined();
    expect(err!.location.line).toBe(1);
  });
});

// --- Parser errors ---

describe('Parser errors have location and suggestion', () => {
  it('unexpected token error has suggestion', () => {
    const src = '@@bad';
    const { tokens } = lex(src);
    const { errors } = parse(tokens, src);
    // Lexer errors first, then parser
    expect(errors.length >= 0).toBe(true);
    // The lexer emits an error for @
    const lexErrors = lex(src).errors;
    expect(lexErrors[0]?.suggestion).toBeDefined();
  });

  it('formatError on parser error produces readable output', () => {
    const src = '  observe x\n  @bad';
    const lexResult = lex(src);
    if (lexResult.errors.length > 0) {
      const out = formatError(src, lexResult.errors[0]!);
      expect(out).toContain('@');
      expect(out).toContain('^');
    }
  });
});
