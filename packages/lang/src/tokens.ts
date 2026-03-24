/**
 * DOT Language Token Definitions — R854.
 *
 * Token types for the DOT syntax:
 *   observe temperature at sensor_7
 *   observe measure: temperature at sensor_7 = 82.3
 *     .gate(temperature > 80)
 *     .pulse(alert: "overheating")
 *   agent gem_scanner { every 5 seconds { ... } }
 */

/** All token types in the DOT language. */
export enum TokenType {
  // --- Keywords: observation types ---
  OBSERVE = 'OBSERVE',
  MEASURE = 'MEASURE',
  STATE = 'STATE',
  EVENT = 'EVENT',
  CLAIM = 'CLAIM',
  BOND = 'BOND',
  PLAIN = 'PLAIN',

  // --- Keywords: function chain ---
  GATE = 'GATE',
  PULSE = 'PULSE',
  CHAIN_KW = 'CHAIN_KW',
  MESH = 'MESH',
  BLOOM = 'BLOOM',
  FADE = 'FADE',
  FORGE = 'FORGE',

  // --- Keywords: agent / temporal ---
  AGENT = 'AGENT',
  EVERY = 'EVERY',

  // --- Keywords: positional ---
  AT = 'AT',
  TO = 'TO',
  WHEN = 'WHEN',
  THEN = 'THEN',
  AFTER = 'AFTER',
  IF = 'IF',

  // --- Keywords: time units ---
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
  DAYS = 'DAYS',

  // --- Keywords: boolean operators ---
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  CONSECUTIVE = 'CONSECUTIVE',

  // --- Structural ---
  DOT = 'DOT',           // '.'
  COLON = 'COLON',       // ':'
  LBRACE = 'LBRACE',     // '{'
  RBRACE = 'RBRACE',     // '}'
  LPAREN = 'LPAREN',     // '('
  RPAREN = 'RPAREN',     // ')'
  LBRACKET = 'LBRACKET', // '['
  RBRACKET = 'RBRACKET', // ']'
  COMMA = 'COMMA',       // ','

  // --- Operators ---
  EQ = 'EQ',     // '='
  GT = 'GT',     // '>'
  LT = 'LT',     // '<'
  GTE = 'GTE',   // '>='
  LTE = 'LTE',   // '<='
  PLUS = 'PLUS',   // '+'
  MINUS = 'MINUS', // '-'
  STAR = 'STAR',   // '*'
  SLASH = 'SLASH', // '/'

  // --- Literals / identifiers ---
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  IDENTIFIER = 'IDENTIFIER',

  // --- Control ---
  NEWLINE = 'NEWLINE',
  COMMENT = 'COMMENT',
  EOF = 'EOF',
}

/** A single token produced by the lexer. */
export interface Token {
  /** The token's type classification. */
  type: TokenType;
  /** Raw source value (string for identifiers/strings, numeric string for numbers). */
  value: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number (position of first char). */
  column: number;
  /** 0-based byte offset in source. */
  offset: number;
}

/**
 * Map of keyword strings to their TokenType.
 * Hand-coded — no regexp lookups.
 */
export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  ['observe', TokenType.OBSERVE],
  ['measure', TokenType.MEASURE],
  ['state', TokenType.STATE],
  ['event', TokenType.EVENT],
  ['claim', TokenType.CLAIM],
  ['bond', TokenType.BOND],
  ['plain', TokenType.PLAIN],
  ['gate', TokenType.GATE],
  ['pulse', TokenType.PULSE],
  ['chain', TokenType.CHAIN_KW],
  ['mesh', TokenType.MESH],
  ['bloom', TokenType.BLOOM],
  ['fade', TokenType.FADE],
  ['forge', TokenType.FORGE],
  ['agent', TokenType.AGENT],
  ['every', TokenType.EVERY],
  ['at', TokenType.AT],
  ['to', TokenType.TO],
  ['when', TokenType.WHEN],
  ['then', TokenType.THEN],
  ['after', TokenType.AFTER],
  ['if', TokenType.IF],
  ['and', TokenType.AND],
  ['or', TokenType.OR],
  ['not', TokenType.NOT],
  ['seconds', TokenType.SECONDS],
  ['minutes', TokenType.MINUTES],
  ['hours', TokenType.HOURS],
  ['days', TokenType.DAYS],
  ['consecutive', TokenType.CONSECUTIVE],
]);

/** Keywords that can appear as function names in .gate(), .pulse(), etc. */
export const FUNCTION_CHAIN_KEYWORDS: ReadonlySet<TokenType> = new Set([
  TokenType.GATE,
  TokenType.PULSE,
  TokenType.CHAIN_KW,
  TokenType.MESH,
  TokenType.BLOOM,
  TokenType.FADE,
  TokenType.FORGE,
]);

/** Time unit keywords. */
export const TIME_UNIT_KEYWORDS: ReadonlySet<TokenType> = new Set([
  TokenType.SECONDS,
  TokenType.MINUTES,
  TokenType.HOURS,
  TokenType.DAYS,
]);
