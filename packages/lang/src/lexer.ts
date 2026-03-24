/**
 * DOT Language Lexer — R854.
 *
 * Hand-written tokenizer. NO regexp for keywords — pure character-by-character scanning.
 *
 * Handles:
 *   - Keywords via static map lookup after identifier read
 *   - # line comments
 *   - "double-quoted strings" with escape sequences
 *   - Integer and float numbers
 *   - Dot-chaining: .gate(..)
 *   - All comparison operators: =, >, <, >=, <=
 *   - Arithmetic: +, -, *, /
 *   - Structural: { } ( ) [ ] , :
 *   - Newlines as significant tokens (statement separators)
 *   - Horizontal whitespace skipped
 */

import { Token, TokenType, KEYWORDS } from './tokens.js';
import { DotError, makeError } from './errors.js';

/** Result of a lex operation. */
export interface LexResult {
  /** Flat list of tokens (including NEWLINE + EOF). */
  tokens: Token[];
  /** Any lexer errors encountered (non-fatal — lexing continues). */
  errors: DotError[];
}

/** Internal lexer state. */
interface LexerState {
  source: string;
  pos: number;
  line: number;
  col: number;
  tokens: Token[];
  errors: DotError[];
}

/**
 * Lex DOT source text into a flat token stream.
 *
 * @param source - Raw DOT source code
 * @returns Tokens and any non-fatal errors
 */
export function lex(source: string): LexResult {
  const s: LexerState = {
    source,
    pos: 0,
    line: 1,
    col: 1,
    tokens: [],
    errors: [],
  };

  while (s.pos < s.source.length) {
    const ch = current(s);

    // Skip horizontal whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance(s);
      continue;
    }

    // Newline — significant token
    if (ch === '\n') {
      const tok = makeToken(s, TokenType.NEWLINE, '\n');
      s.tokens.push(tok);
      advance(s); // consumes \n, increments line
      continue;
    }

    // Comment: # to end of line
    if (ch === '#') {
      readComment(s);
      continue;
    }

    // String literal
    if (ch === '"') {
      readString(s);
      continue;
    }

    // Number: digit or minus-digit
    if (isDigit(ch)) {
      readNumber(s);
      continue;
    }

    // Identifier or keyword
    if (isIdentStart(ch)) {
      readIdentifier(s);
      continue;
    }

    // Operators and punctuation
    if (ch === '.') {
      s.tokens.push(makeToken(s, TokenType.DOT, '.'));
      advance(s);
      continue;
    }

    if (ch === ':') {
      s.tokens.push(makeToken(s, TokenType.COLON, ':'));
      advance(s);
      continue;
    }

    if (ch === '{') {
      s.tokens.push(makeToken(s, TokenType.LBRACE, '{'));
      advance(s);
      continue;
    }

    if (ch === '}') {
      s.tokens.push(makeToken(s, TokenType.RBRACE, '}'));
      advance(s);
      continue;
    }

    if (ch === '(') {
      s.tokens.push(makeToken(s, TokenType.LPAREN, '('));
      advance(s);
      continue;
    }

    if (ch === ')') {
      s.tokens.push(makeToken(s, TokenType.RPAREN, ')'));
      advance(s);
      continue;
    }

    if (ch === '[') {
      s.tokens.push(makeToken(s, TokenType.LBRACKET, '['));
      advance(s);
      continue;
    }

    if (ch === ']') {
      s.tokens.push(makeToken(s, TokenType.RBRACKET, ']'));
      advance(s);
      continue;
    }

    if (ch === ',') {
      s.tokens.push(makeToken(s, TokenType.COMMA, ','));
      advance(s);
      continue;
    }

    if (ch === '+') {
      s.tokens.push(makeToken(s, TokenType.PLUS, '+'));
      advance(s);
      continue;
    }

    if (ch === '-') {
      // Could be negative number: -42, -3.14
      if (isDigit(peek(s))) {
        readNumber(s);
      } else {
        s.tokens.push(makeToken(s, TokenType.MINUS, '-'));
        advance(s);
      }
      continue;
    }

    if (ch === '*') {
      s.tokens.push(makeToken(s, TokenType.STAR, '*'));
      advance(s);
      continue;
    }

    if (ch === '/') {
      s.tokens.push(makeToken(s, TokenType.SLASH, '/'));
      advance(s);
      continue;
    }

    if (ch === '>') {
      const startLine = s.line;
      const startCol = s.col;
      const startPos = s.pos;
      advance(s);
      if (current(s) === '=') {
        advance(s);
        s.tokens.push({ type: TokenType.GTE, value: '>=', line: startLine, column: startCol, offset: startPos });
      } else {
        s.tokens.push({ type: TokenType.GT, value: '>', line: startLine, column: startCol, offset: startPos });
      }
      continue;
    }

    if (ch === '<') {
      const startLine = s.line;
      const startCol = s.col;
      const startPos = s.pos;
      advance(s);
      if (current(s) === '=') {
        advance(s);
        s.tokens.push({ type: TokenType.LTE, value: '<=', line: startLine, column: startCol, offset: startPos });
      } else {
        s.tokens.push({ type: TokenType.LT, value: '<', line: startLine, column: startCol, offset: startPos });
      }
      continue;
    }

    if (ch === '=') {
      s.tokens.push(makeToken(s, TokenType.EQ, '='));
      advance(s);
      continue;
    }

    // Unknown character — emit error, skip
    s.errors.push(
      makeError(
        `Unexpected character '${ch}'`,
        { line: s.line, column: s.col, offset: s.pos },
        `Remove or replace the character '${ch}'`,
      ),
    );
    advance(s);
  }

  // Terminal EOF
  s.tokens.push({ type: TokenType.EOF, value: '', line: s.line, column: s.col, offset: s.pos });

  return { tokens: s.tokens, errors: s.errors };
}

// --- Internal helpers ---

function current(s: LexerState): string {
  return s.source[s.pos] ?? '';
}

function peek(s: LexerState, offset = 1): string {
  return s.source[s.pos + offset] ?? '';
}

function advance(s: LexerState): string {
  const ch = s.source[s.pos] ?? '';
  s.pos++;
  if (ch === '\n') {
    s.line++;
    s.col = 1;
  } else {
    s.col++;
  }
  return ch;
}

function makeToken(s: LexerState, type: TokenType, value: string): Token {
  return { type, value, line: s.line, column: s.col, offset: s.pos };
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentContinue(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch);
}

/** Read a # comment — everything until (but not including) the newline. */
function readComment(s: LexerState): void {
  const startLine = s.line;
  const startCol = s.col;
  const startPos = s.pos;
  let value = '';
  while (s.pos < s.source.length && current(s) !== '\n') {
    value += advance(s);
  }
  s.tokens.push({ type: TokenType.COMMENT, value, line: startLine, column: startCol, offset: startPos });
}

/** Read a double-quoted string literal with basic escape handling. */
function readString(s: LexerState): void {
  const startLine = s.line;
  const startCol = s.col;
  const startPos = s.pos;
  advance(s); // consume opening "

  let value = '';
  while (s.pos < s.source.length) {
    const ch = current(s);
    if (ch === '"') {
      advance(s); // consume closing "
      s.tokens.push({ type: TokenType.STRING, value, line: startLine, column: startCol, offset: startPos });
      return;
    }
    if (ch === '\\') {
      advance(s); // consume backslash
      const escaped = current(s);
      switch (escaped) {
        case 'n': value += '\n'; break;
        case 't': value += '\t'; break;
        case 'r': value += '\r'; break;
        case '"': value += '"'; break;
        case '\\': value += '\\'; break;
        default: value += escaped; break;
      }
      advance(s);
      continue;
    }
    if (ch === '\n') {
      // Unterminated string — emit error, stop
      s.errors.push(
        makeError(
          'Unterminated string literal',
          { line: startLine, column: startCol, offset: startPos },
          'Add a closing " before the end of the line',
        ),
      );
      s.tokens.push({ type: TokenType.STRING, value, line: startLine, column: startCol, offset: startPos });
      return;
    }
    value += advance(s);
  }

  // EOF without closing quote
  s.errors.push(
    makeError(
      'Unterminated string literal at end of file',
      { line: startLine, column: startCol, offset: startPos },
      'Add a closing " to terminate the string',
    ),
  );
  s.tokens.push({ type: TokenType.STRING, value, line: startLine, column: startCol, offset: startPos });
}

/** Read an integer or float number (including negative: -42, -3.14). */
function readNumber(s: LexerState): void {
  const startLine = s.line;
  const startCol = s.col;
  const startPos = s.pos;
  let value = '';

  // Optional leading minus
  if (current(s) === '-') {
    value += advance(s);
  }

  // Integer part
  while (s.pos < s.source.length && isDigit(current(s))) {
    value += advance(s);
  }

  // Optional fractional part
  if (current(s) === '.' && isDigit(peek(s))) {
    value += advance(s); // consume '.'
    while (s.pos < s.source.length && isDigit(current(s))) {
      value += advance(s);
    }
  }

  s.tokens.push({ type: TokenType.NUMBER, value, line: startLine, column: startCol, offset: startPos });
}

/** Read an identifier, then check against keyword map. */
function readIdentifier(s: LexerState): void {
  const startLine = s.line;
  const startCol = s.col;
  const startPos = s.pos;
  let value = '';

  while (s.pos < s.source.length && isIdentContinue(current(s))) {
    value += advance(s);
  }

  // Keyword lookup (no regexp)
  const kwType = KEYWORDS.get(value);
  const type = kwType ?? TokenType.IDENTIFIER;

  s.tokens.push({ type, value, line: startLine, column: startCol, offset: startPos });
}
