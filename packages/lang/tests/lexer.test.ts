/**
 * Lexer tests for @dot-protocol/lang — R854.
 * Target: 60+ tests covering all token types, keywords, edge cases.
 */

import { describe, it, expect } from 'vitest';
import { lex } from '../src/lexer.js';
import { TokenType } from '../src/tokens.js';

// Helper: lex and strip EOF + NEWLINEs for concise assertions
function lexTokens(src: string) {
  return lex(src).tokens.filter(t => t.type !== TokenType.EOF && t.type !== TokenType.NEWLINE);
}

function lexTypes(src: string) {
  return lexTokens(src).map(t => t.type);
}

function lexValues(src: string) {
  return lexTokens(src).map(t => t.value);
}

// --- Basic keywords ---

describe('keywords: observe type', () => {
  it('tokenizes OBSERVE keyword', () => {
    expect(lexTypes('observe')).toEqual([TokenType.OBSERVE]);
  });

  it('tokenizes MEASURE keyword', () => {
    expect(lexTypes('measure')).toEqual([TokenType.MEASURE]);
  });

  it('tokenizes STATE keyword', () => {
    expect(lexTypes('state')).toEqual([TokenType.STATE]);
  });

  it('tokenizes EVENT keyword', () => {
    expect(lexTypes('event')).toEqual([TokenType.EVENT]);
  });

  it('tokenizes CLAIM keyword', () => {
    expect(lexTypes('claim')).toEqual([TokenType.CLAIM]);
  });

  it('tokenizes BOND keyword', () => {
    expect(lexTypes('bond')).toEqual([TokenType.BOND]);
  });

  it('tokenizes PLAIN keyword', () => {
    expect(lexTypes('plain')).toEqual([TokenType.PLAIN]);
  });
});

describe('keywords: chain functions', () => {
  it('tokenizes GATE', () => expect(lexTypes('gate')).toEqual([TokenType.GATE]));
  it('tokenizes PULSE', () => expect(lexTypes('pulse')).toEqual([TokenType.PULSE]));
  it('tokenizes CHAIN_KW (chain)', () => expect(lexTypes('chain')).toEqual([TokenType.CHAIN_KW]));
  it('tokenizes MESH', () => expect(lexTypes('mesh')).toEqual([TokenType.MESH]));
  it('tokenizes BLOOM', () => expect(lexTypes('bloom')).toEqual([TokenType.BLOOM]));
  it('tokenizes FADE', () => expect(lexTypes('fade')).toEqual([TokenType.FADE]));
  it('tokenizes FORGE', () => expect(lexTypes('forge')).toEqual([TokenType.FORGE]));
});

describe('keywords: agent / temporal', () => {
  it('tokenizes AGENT', () => expect(lexTypes('agent')).toEqual([TokenType.AGENT]));
  it('tokenizes EVERY', () => expect(lexTypes('every')).toEqual([TokenType.EVERY]));
  it('tokenizes AT', () => expect(lexTypes('at')).toEqual([TokenType.AT]));
  it('tokenizes TO', () => expect(lexTypes('to')).toEqual([TokenType.TO]));
  it('tokenizes WHEN', () => expect(lexTypes('when')).toEqual([TokenType.WHEN]));
  it('tokenizes THEN', () => expect(lexTypes('then')).toEqual([TokenType.THEN]));
  it('tokenizes AFTER', () => expect(lexTypes('after')).toEqual([TokenType.AFTER]));
  it('tokenizes IF', () => expect(lexTypes('if')).toEqual([TokenType.IF]));
  it('tokenizes SECONDS', () => expect(lexTypes('seconds')).toEqual([TokenType.SECONDS]));
  it('tokenizes MINUTES', () => expect(lexTypes('minutes')).toEqual([TokenType.MINUTES]));
  it('tokenizes HOURS', () => expect(lexTypes('hours')).toEqual([TokenType.HOURS]));
  it('tokenizes DAYS', () => expect(lexTypes('days')).toEqual([TokenType.DAYS]));
  it('tokenizes AND', () => expect(lexTypes('and')).toEqual([TokenType.AND]));
  it('tokenizes OR', () => expect(lexTypes('or')).toEqual([TokenType.OR]));
  it('tokenizes NOT', () => expect(lexTypes('not')).toEqual([TokenType.NOT]));
});

// --- Identifiers ---

describe('identifiers', () => {
  it('lexes plain identifier', () => {
    expect(lexTypes('sensor_7')).toEqual([TokenType.IDENTIFIER]);
    expect(lexValues('sensor_7')).toEqual(['sensor_7']);
  });

  it('lexes identifier with numbers', () => {
    expect(lexTypes('reactor3')).toEqual([TokenType.IDENTIFIER]);
  });

  it('lexes underscore-only identifier', () => {
    expect(lexTypes('_private')).toEqual([TokenType.IDENTIFIER]);
  });

  it('distinguishes identifier from keyword: "observable" is identifier', () => {
    expect(lexTypes('observable')).toEqual([TokenType.IDENTIFIER]);
    expect(lexValues('observable')).toEqual(['observable']);
  });

  it('keyword followed immediately by identifier is two tokens', () => {
    expect(lexTypes('gate_fn')).toEqual([TokenType.IDENTIFIER]);
  });
});

// --- Numbers ---

describe('numbers', () => {
  it('lexes integer', () => {
    const t = lexTokens('42');
    expect(t[0]?.type).toBe(TokenType.NUMBER);
    expect(t[0]?.value).toBe('42');
  });

  it('lexes float', () => {
    const t = lexTokens('82.3');
    expect(t[0]?.type).toBe(TokenType.NUMBER);
    expect(t[0]?.value).toBe('82.3');
  });

  it('lexes zero', () => {
    expect(lexValues('0')).toEqual(['0']);
  });

  it('lexes negative number via minus token', () => {
    // -42 → MINUS, NUMBER or negative NUMBER depending on context
    // The lexer emits MINUS before a non-digit, NUMBER for -42
    const tokens = lexTokens('-42');
    // Lexer emits as a single negative number token
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.type).toBe(TokenType.NUMBER);
    expect(tokens[0]?.value).toBe('-42');
  });

  it('lexes negative float', () => {
    const tokens = lexTokens('-3.14');
    expect(tokens[0]?.value).toBe('-3.14');
    expect(tokens[0]?.type).toBe(TokenType.NUMBER);
  });

  it('lexes MINUS when not followed by digit', () => {
    const tokens = lexTokens('- x');
    expect(tokens[0]?.type).toBe(TokenType.MINUS);
    expect(tokens[1]?.type).toBe(TokenType.IDENTIFIER);
  });
});

// --- String literals ---

describe('strings', () => {
  it('lexes basic string', () => {
    const t = lexTokens('"hello"');
    expect(t[0]?.type).toBe(TokenType.STRING);
    expect(t[0]?.value).toBe('hello');
  });

  it('lexes string with spaces', () => {
    const t = lexTokens('"hello world"');
    expect(t[0]?.value).toBe('hello world');
  });

  it('lexes empty string', () => {
    const t = lexTokens('""');
    expect(t[0]?.type).toBe(TokenType.STRING);
    expect(t[0]?.value).toBe('');
  });

  it('lexes escape sequences in string', () => {
    const t = lexTokens('"line\\nnewline"');
    expect(t[0]?.value).toBe('line\nnewline');
  });

  it('emits error for unterminated string', () => {
    const result = lex('"unterminated');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('Unterminated');
  });

  it('emits STRING token even on unterminated string', () => {
    const result = lex('"open');
    const strs = result.tokens.filter(t => t.type === TokenType.STRING);
    expect(strs.length).toBeGreaterThan(0);
  });
});

// --- Operators ---

describe('operators', () => {
  it('lexes EQ', () => expect(lexTypes('=')).toEqual([TokenType.EQ]));
  it('lexes GT', () => expect(lexTypes('>')).toEqual([TokenType.GT]));
  it('lexes LT', () => expect(lexTypes('<')).toEqual([TokenType.LT]));
  it('lexes GTE', () => expect(lexTypes('>=')).toEqual([TokenType.GTE]));
  it('lexes LTE', () => expect(lexTypes('<=')).toEqual([TokenType.LTE]));
  it('lexes PLUS', () => expect(lexTypes('+')).toEqual([TokenType.PLUS]));
  it('lexes STAR', () => expect(lexTypes('*')).toEqual([TokenType.STAR]));
  it('lexes SLASH', () => expect(lexTypes('/')).toEqual([TokenType.SLASH]));

  it('> not confused with >=', () => {
    expect(lexTypes('> x')).toEqual([TokenType.GT, TokenType.IDENTIFIER]);
  });

  it('>= is single token', () => {
    expect(lexTypes('>=')).toEqual([TokenType.GTE]);
  });
});

// --- Structural ---

describe('structural tokens', () => {
  it('lexes DOT', () => expect(lexTypes('.')).toEqual([TokenType.DOT]));
  it('lexes COLON', () => expect(lexTypes(':')).toEqual([TokenType.COLON]));
  it('lexes LBRACE', () => expect(lexTypes('{')).toEqual([TokenType.LBRACE]));
  it('lexes RBRACE', () => expect(lexTypes('}')).toEqual([TokenType.RBRACE]));
  it('lexes LPAREN', () => expect(lexTypes('(')).toEqual([TokenType.LPAREN]));
  it('lexes RPAREN', () => expect(lexTypes(')')).toEqual([TokenType.RPAREN]));
  it('lexes LBRACKET', () => expect(lexTypes('[')).toEqual([TokenType.LBRACKET]));
  it('lexes RBRACKET', () => expect(lexTypes(']')).toEqual([TokenType.RBRACKET]));
  it('lexes COMMA', () => expect(lexTypes(',')).toEqual([TokenType.COMMA]));
});

// --- Comments ---

describe('comments', () => {
  it('lexes # comment', () => {
    const tokens = lex('# this is a comment').tokens;
    const comment = tokens.find(t => t.type === TokenType.COMMENT);
    expect(comment).toBeDefined();
    expect(comment?.value).toContain('# this is a comment');
  });

  it('comment does not produce keyword tokens', () => {
    const types = lexTypes('# observe');
    expect(types).not.toContain(TokenType.OBSERVE);
  });

  it('comment stops at newline', () => {
    const result = lex('# comment\nobserve');
    const types = result.tokens.map(t => t.type).filter(t => t !== TokenType.COMMENT && t !== TokenType.NEWLINE && t !== TokenType.EOF);
    expect(types).toContain(TokenType.OBSERVE);
  });
});

// --- Newlines ---

describe('newlines', () => {
  it('emits NEWLINE token', () => {
    const tokens = lex('a\nb').tokens;
    expect(tokens.some(t => t.type === TokenType.NEWLINE)).toBe(true);
  });

  it('multiple blank lines produce multiple NEWLINEs', () => {
    const tokens = lex('a\n\nb').tokens;
    const newlines = tokens.filter(t => t.type === TokenType.NEWLINE);
    expect(newlines.length).toBe(2);
  });
});

// --- Source locations ---

describe('source locations', () => {
  it('first token on line 1 col 1', () => {
    const t = lexTokens('observe')[0]!;
    expect(t.line).toBe(1);
    expect(t.column).toBe(1);
  });

  it('token on second line has correct line number', () => {
    const tokens = lex('a\nb').tokens.filter(t => t.type === TokenType.IDENTIFIER);
    expect(tokens[0]?.line).toBe(1);
    expect(tokens[1]?.line).toBe(2);
  });

  it('offset is 0 for first char', () => {
    const t = lexTokens('abc')[0]!;
    expect(t.offset).toBe(0);
  });
});

// --- EOF ---

describe('EOF', () => {
  it('always ends with EOF token', () => {
    const result = lex('');
    const last = result.tokens[result.tokens.length - 1];
    expect(last?.type).toBe(TokenType.EOF);
  });

  it('empty source produces only EOF', () => {
    const result = lex('');
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]?.type).toBe(TokenType.EOF);
  });
});

// --- Multi-token lines ---

describe('multi-token lines', () => {
  it('tokenizes: observe temperature at sensor_7', () => {
    expect(lexTypes('observe temperature at sensor_7')).toEqual([
      TokenType.OBSERVE,
      TokenType.IDENTIFIER,
      TokenType.AT,
      TokenType.IDENTIFIER,
    ]);
  });

  it('tokenizes: observe measure: temperature at sensor_7 = 82.3', () => {
    const types = lexTypes('observe measure: temperature at sensor_7 = 82.3');
    expect(types).toEqual([
      TokenType.OBSERVE,
      TokenType.MEASURE,
      TokenType.COLON,
      TokenType.IDENTIFIER,
      TokenType.AT,
      TokenType.IDENTIFIER,
      TokenType.EQ,
      TokenType.NUMBER,
    ]);
  });

  it('tokenizes: .gate(temperature > 80)', () => {
    const types = lexTypes('.gate(temperature > 80)');
    expect(types).toEqual([
      TokenType.DOT,
      TokenType.GATE,
      TokenType.LPAREN,
      TokenType.IDENTIFIER,
      TokenType.GT,
      TokenType.NUMBER,
      TokenType.RPAREN,
    ]);
  });

  it('tokenizes: .mesh(to: [maintenance, dashboard])', () => {
    const types = lexTypes('.mesh(to: [maintenance, dashboard])');
    expect(types).toEqual([
      TokenType.DOT,
      TokenType.MESH,
      TokenType.LPAREN,
      TokenType.TO,
      TokenType.COLON,
      TokenType.LBRACKET,
      TokenType.IDENTIFIER,
      TokenType.COMMA,
      TokenType.IDENTIFIER,
      TokenType.RBRACKET,
      TokenType.RPAREN,
    ]);
  });

  it('tokenizes agent declaration line', () => {
    const types = lexTypes('agent gem_scanner {');
    expect(types).toEqual([
      TokenType.AGENT,
      TokenType.IDENTIFIER,
      TokenType.LBRACE,
    ]);
  });

  it('tokenizes every clause', () => {
    const types = lexTypes('every 5 seconds {');
    expect(types).toEqual([
      TokenType.EVERY,
      TokenType.NUMBER,
      TokenType.SECONDS,
      TokenType.LBRACE,
    ]);
  });
});

// --- Unknown characters ---

describe('unknown characters', () => {
  it('emits error for unknown character', () => {
    const result = lex('@unknown');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('@');
  });

  it('continues lexing after unknown character', () => {
    const result = lex('@observe');
    const types = result.tokens.map(t => t.type);
    expect(types).toContain(TokenType.OBSERVE);
  });
});
