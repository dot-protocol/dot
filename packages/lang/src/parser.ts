/**
 * DOT Language Parser — R854.
 *
 * Recursive descent parser. Produces an AST matching ast.ts types.
 * Error recovery: on parse error, skip to next newline and continue.
 *
 * Handles:
 *   observe [type:] [name] [at location] [= value]
 *     .gate(expr)
 *     .pulse(named: value, ...)
 *     .chain(...)
 *     .mesh(to: [a, b])
 *     .bloom(when: ..., then: ...)
 *     .fade(after: ...)
 *     .forge(action: ...)
 *
 *   agent name {
 *     every N unit {
 *       statements
 *     }
 *   }
 *
 * Expression precedence (low → high):
 *   or → and → comparison → unary → call/member → atom
 */

import { Token, TokenType, FUNCTION_CHAIN_KEYWORDS, TIME_UNIT_KEYWORDS } from './tokens.js';
import type {
  Program,
  Statement,
  ObserveStatement,
  AgentStatement,
  FunctionCall,
  Expression,
  NamedArg,
  BinaryExpr,
  Literal,
  Identifier,
  FuncCallExpr,
  MemberAccess,
  ArrayLiteral,
  SourceLocation,
} from './ast.js';
import { DotError, makeError } from './errors.js';

/** Result of a parse operation. */
export interface ParseResult {
  /** The parsed program AST. */
  ast: Program;
  /** Non-fatal parse errors (error recovery was applied). */
  errors: DotError[];
}

/** Internal parser state. */
interface ParserState {
  tokens: Token[];
  pos: number;
  errors: DotError[];
  source: string;
}

/**
 * Parse a flat token stream into a Program AST.
 *
 * @param tokens - Token list from the lexer (must end with EOF)
 * @param source - Original source (for error messages)
 * @returns Program AST and any non-fatal parse errors
 */
export function parse(tokens: Token[], source = ''): ParseResult {
  const s: ParserState = {
    tokens: tokens.filter(t => t.type !== TokenType.COMMENT), // strip comments
    pos: 0,
    errors: [],
    source,
  };

  const loc = tokenLoc(current(s));
  const body = parseProgram(s);

  return {
    ast: { type: 'Program', body, loc },
    errors: s.errors,
  };
}

// ---------------------------------------------------------------------------
// Top-level
// ---------------------------------------------------------------------------

function parseProgram(s: ParserState): Statement[] {
  const stmts: Statement[] = [];
  skipNewlines(s);
  while (!atEnd(s)) {
    const stmt = parseStatement(s);
    if (stmt) stmts.push(stmt);
    skipNewlines(s);
  }
  return stmts;
}

function parseStatement(s: ParserState): Statement | null {
  const tok = current(s);
  if (tok.type === TokenType.OBSERVE) {
    return parseObserve(s);
  }
  if (tok.type === TokenType.AGENT) {
    return parseAgent(s);
  }
  // Unknown token at statement level — error, recover
  if (tok.type !== TokenType.EOF) {
    s.errors.push(
      makeError(
        `Unexpected token '${tok.value}' — expected 'observe' or 'agent'`,
        tokenLoc(tok),
        `Start a statement with 'observe' or 'agent'`,
      ),
    );
    skipToNextLine(s);
  }
  return null;
}

// ---------------------------------------------------------------------------
// observe statement
// ---------------------------------------------------------------------------

/**
 * Parse an observe statement:
 *   observe [type:] [name] [at location] [= value]
 *     (.function(args))*
 */
function parseObserve(s: ParserState): ObserveStatement {
  const startTok = current(s);
  const loc = tokenLoc(startTok);
  advance(s); // consume 'observe'

  let observationType: string | undefined;
  let name: string | undefined;
  let location: Expression | undefined;
  let value: Expression | undefined;

  // Check for observe type keyword: measure|state|event|claim|bond|plain
  // Pattern: observe TYPE_KW: ... or observe TYPE_KW identifier ...
  // The type keyword is followed by COLON or an identifier/location
  if (isObserveTypeKeyword(current(s))) {
    const typeTok = current(s);
    // Peek ahead: if next after keyword is COLON, it's the type annotation
    const nextTok = peekAt(s, 1);
    if (nextTok.type === TokenType.COLON) {
      // observe measure: name at location = value
      observationType = typeTok.value;
      advance(s); // consume type keyword
      advance(s); // consume ':'
    } else if (nextTok.type === TokenType.NEWLINE || nextTok.type === TokenType.DOT || nextTok.type === TokenType.EOF) {
      // observe measure  (no colon, no name — the type IS the whole statement)
      observationType = typeTok.value;
      advance(s);
    } else {
      // No colon — treat the type keyword as a standalone keyword type (R854 bare form)
      observationType = typeTok.value;
      advance(s);
    }
  }

  // Parse optional name identifier or member access (e.g. token.price) before AT/EQ/NEWLINE/EOF
  // Only consume as name if followed by AT, EQ, NEWLINE, EOF, or another IDENTIFIER (bonds like sensor_7 is_part_of...)
  // NOT consumed as name if followed by DOT that leads to a non-chain-fn (handled as location via parsePostfix)
  if (current(s).type === TokenType.IDENTIFIER) {
    const nextT = peekAt(s, 1);
    const isSimpleNameContext =
      nextT.type === TokenType.AT ||
      nextT.type === TokenType.EQ ||
      nextT.type === TokenType.NEWLINE ||
      nextT.type === TokenType.EOF ||
      nextT.type === TokenType.IDENTIFIER; // bond forms: "sensor_7 is_part_of..."
    const isDotFollowedByChainFn =
      nextT.type === TokenType.DOT &&
      FUNCTION_CHAIN_KEYWORDS.has(peekAt(s, 2).type);
    if (isSimpleNameContext || isDotFollowedByChainFn) {
      // Consume as simple name (no member access resolution here)
      name = current(s).value;
      advance(s);
    } else if (nextT.type === TokenType.DOT) {
      // Could be member access name like token.price: parse as postfix expression
      // and convert to dotted string name
      const expr = parsePostfix(s);
      if (expr.type === 'MemberAccess') {
        name = exprToString(expr);
      } else if (expr.type === 'Identifier') {
        name = (expr as Identifier).name;
      }
      // else: leave name undefined, restore would be complex — just proceed
    }
  }

  // After a type annotation with colon (e.g. plain: "string" or plain: 42), the value may be
  // directly next (no name, no AT). Handle this case.
  if (observationType !== undefined && name === undefined && !atStatementEnd(s) &&
      current(s).type !== TokenType.AT && current(s).type !== TokenType.EQ) {
    // Direct value after type annotation: observe plain: "..."
    if (current(s).type === TokenType.STRING || current(s).type === TokenType.NUMBER) {
      value = parseExpression(s);
    }
  }

  // Parse AT clause
  if (current(s).type === TokenType.AT) {
    advance(s); // consume 'at'
    // Location: parse as postfix expression (handles member access and function calls)
    if (!atStatementEnd(s)) {
      location = parsePostfix(s);
    }
  }

  // Parse = value
  if (current(s).type === TokenType.EQ) {
    advance(s); // consume '='
    if (!atStatementEnd(s)) {
      value = parseExpression(s);
    }
  }

  // Parse dot-chained function calls on subsequent indented lines
  const functionChain = parseFunctionChain(s);

  return {
    type: 'ObserveStatement',
    observationType,
    name,
    location,
    value,
    functionChain,
    loc,
  };
}

/** Check if token is an observe-type keyword. */
function isObserveTypeKeyword(tok: Token): boolean {
  return (
    tok.type === TokenType.MEASURE ||
    tok.type === TokenType.STATE ||
    tok.type === TokenType.EVENT ||
    tok.type === TokenType.CLAIM ||
    tok.type === TokenType.BOND ||
    tok.type === TokenType.PLAIN
  );
}

/** True if current token starts or ends a statement (not a value). */
function atStatementEnd(s: ParserState): boolean {
  const t = current(s).type;
  return (
    t === TokenType.NEWLINE ||
    t === TokenType.EOF ||
    t === TokenType.RBRACE
  );
}

function isAtOrAssign(tok: Token): boolean {
  return tok.type === TokenType.AT || tok.type === TokenType.EQ;
}

// ---------------------------------------------------------------------------
// agent statement
// ---------------------------------------------------------------------------

/**
 * Parse an agent definition:
 *   agent name {
 *     every N unit {
 *       statements
 *     }
 *   }
 */
function parseAgent(s: ParserState): AgentStatement {
  const startTok = current(s);
  const loc = tokenLoc(startTok);
  advance(s); // consume 'agent'

  // Agent name
  const nameTok = current(s);
  let agentName = '';
  if (nameTok.type === TokenType.IDENTIFIER) {
    agentName = nameTok.value;
    advance(s);
  } else {
    s.errors.push(
      makeError(
        `Expected agent name after 'agent', got '${nameTok.value}'`,
        tokenLoc(nameTok),
        `Provide an identifier name for the agent`,
      ),
    );
  }

  skipNewlines(s);
  expect(s, TokenType.LBRACE);
  skipNewlines(s);

  // Optional every clause
  let everyClause: { value: number; unit: string } | undefined;
  const stmts: Statement[] = [];

  if (current(s).type === TokenType.EVERY) {
    advance(s); // consume 'every'
    const numTok = current(s);
    let everyValue = 1;
    if (numTok.type === TokenType.NUMBER) {
      everyValue = parseFloat(numTok.value);
      advance(s);
    } else {
      s.errors.push(
        makeError(
          `Expected number after 'every', got '${numTok.value}'`,
          tokenLoc(numTok),
          `Provide a numeric interval (e.g., 'every 5 seconds')`,
        ),
      );
    }

    // Time unit
    const unitTok = current(s);
    let everyUnit = 'seconds';
    if (TIME_UNIT_KEYWORDS.has(unitTok.type)) {
      everyUnit = unitTok.value;
      advance(s);
    } else {
      s.errors.push(
        makeError(
          `Expected time unit (seconds/minutes/hours/days) after number, got '${unitTok.value}'`,
          tokenLoc(unitTok),
          `Add a time unit: seconds, minutes, hours, or days`,
        ),
      );
    }

    everyClause = { value: everyValue, unit: everyUnit };

    skipNewlines(s);
    expect(s, TokenType.LBRACE);
    skipNewlines(s);

    // Parse body statements
    while (current(s).type !== TokenType.RBRACE && !atEnd(s)) {
      const stmt = parseStatement(s);
      if (stmt) stmts.push(stmt);
      skipNewlines(s);
    }

    expect(s, TokenType.RBRACE);
  } else {
    // Body without every clause
    while (current(s).type !== TokenType.RBRACE && !atEnd(s)) {
      const stmt = parseStatement(s);
      if (stmt) stmts.push(stmt);
      skipNewlines(s);
    }
  }

  skipNewlines(s);
  expect(s, TokenType.RBRACE);

  return {
    type: 'AgentStatement',
    name: agentName,
    every: everyClause,
    body: stmts,
    loc,
  };
}

// ---------------------------------------------------------------------------
// Function chain: .gate(...) .pulse(...) etc.
// ---------------------------------------------------------------------------

/**
 * Parse dot-chained function calls.
 * Each call starts with a DOT on the same or next line.
 * We consume leading newlines then check for DOT.
 */
function parseFunctionChain(s: ParserState): FunctionCall[] {
  const calls: FunctionCall[] = [];

  // Consume newlines, check for DOT
  while (true) {
    // Skip newlines
    const savedPos = s.pos;
    skipNewlines(s);

    const tok = current(s);
    if (tok.type !== TokenType.DOT) {
      // No more chained calls — restore position to before newlines if no dot found
      // Actually we should keep position after newlines (they're consumed)
      // But if there's no dot, we've consumed newlines that belong to next statement
      // Restore pos to before newline skipping
      s.pos = savedPos;
      break;
    }

    // DOT followed by function name — must be a recognized chain keyword
    // If not a chain keyword, restore and stop (this DOT belongs to a member access or something else)
    const fnTok = peekAt(s, 1); // peek at what follows the DOT
    if (!isChainFunctionName(fnTok)) {
      s.pos = savedPos; // restore to before newlines
      break;
    }

    const dotTok = tok;
    advance(s); // consume DOT
    const actualFnTok = current(s);
    const fnName = actualFnTok.value;

    const loc = tokenLoc(dotTok);
    advance(s); // consume function name

    // Parse argument list: (arg, arg, ...)
    const args = parseFunctionArgs(s);

    calls.push({
      type: 'FunctionCall',
      name: fnName,
      args,
      loc,
    });
  }

  return calls;
}

/**
 * Only the 7 recognized chain function keywords are valid chain function names.
 * Arbitrary identifiers are NOT valid — this prevents member access like .price
 * from being incorrectly consumed as a chain call.
 */
function isChainFunctionName(tok: Token): boolean {
  return FUNCTION_CHAIN_KEYWORDS.has(tok.type);
}

/** Convert an expression to a dotted string name (for member access names). */
function exprToString(expr: Expression): string {
  if (expr.type === 'Identifier') return (expr as Identifier).name;
  if (expr.type === 'MemberAccess') {
    const ma = expr as MemberAccess;
    return `${exprToString(ma.object)}.${ma.property}`;
  }
  return '__expr__';
}

/** Parse (arg, arg, ...) — returns list of named args and expressions. */
function parseFunctionArgs(s: ParserState): (Expression | NamedArg)[] {
  const args: (Expression | NamedArg)[] = [];

  if (current(s).type !== TokenType.LPAREN) {
    return args;
  }
  advance(s); // consume '('

  // Empty args
  if (current(s).type === TokenType.RPAREN) {
    advance(s);
    return args;
  }

  // Parse arg list
  while (current(s).type !== TokenType.RPAREN && !atEnd(s)) {
    const arg = parseCallArg(s);
    if (arg) args.push(arg);

    if (current(s).type === TokenType.COMMA) {
      advance(s); // consume ','
    } else {
      break;
    }
  }

  if (current(s).type === TokenType.RPAREN) {
    advance(s); // consume ')'
  } else {
    s.errors.push(
      makeError(
        `Expected ')' to close function argument list`,
        tokenLoc(current(s)),
        `Add a closing ')' after the last argument`,
      ),
    );
  }

  return args;
}

/**
 * Parse a single call argument.
 * Named arg: IDENTIFIER COLON expr
 * Positional arg: expr
 */
function parseCallArg(s: ParserState): Expression | NamedArg | null {
  // Named arg: ident: expr
  if (
    current(s).type === TokenType.IDENTIFIER &&
    peekAt(s, 1).type === TokenType.COLON
  ) {
    const nameTok = current(s);
    const loc = tokenLoc(nameTok);
    advance(s); // consume identifier
    advance(s); // consume ':'
    const value = parseExpression(s);
    return { type: 'NamedArg', name: nameTok.value, value, loc };
  }

  // Also handle keyword-as-name: when: ..., then: ..., after: ..., action: ..., to: ...
  if (isKeywordUsableAsName(current(s)) && peekAt(s, 1).type === TokenType.COLON) {
    const nameTok = current(s);
    const loc = tokenLoc(nameTok);
    advance(s);
    advance(s); // consume ':'
    const value = parseExpression(s);
    return { type: 'NamedArg', name: nameTok.value, value, loc };
  }

  return parseExpression(s);
}

/** Keywords that can appear as named argument names. */
function isKeywordUsableAsName(tok: Token): boolean {
  return (
    tok.type === TokenType.WHEN ||
    tok.type === TokenType.THEN ||
    tok.type === TokenType.AFTER ||
    tok.type === TokenType.TO ||
    tok.type === TokenType.AT
  );
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

/**
 * Parse an expression.
 * Precedence (low → high):
 *   or → and → comparison → unary → postfix (call/member) → atom
 */
function parseExpression(s: ParserState): Expression {
  return parseOr(s);
}

function parseOr(s: ParserState): Expression {
  let left = parseAnd(s);
  while (current(s).type === TokenType.OR) {
    const loc = tokenLoc(current(s));
    advance(s);
    const right = parseAnd(s);
    left = { type: 'BinaryExpr', left, op: 'or', right, loc } as BinaryExpr;
  }
  return left;
}

function parseAnd(s: ParserState): Expression {
  let left = parseComparison(s);
  while (current(s).type === TokenType.AND) {
    const loc = tokenLoc(current(s));
    advance(s);
    const right = parseComparison(s);
    left = { type: 'BinaryExpr', left, op: 'and', right, loc } as BinaryExpr;
  }
  return left;
}

function parseComparison(s: ParserState): Expression {
  let left = parseAddSub(s);
  while (isComparisonOp(current(s))) {
    const opTok = current(s);
    const loc = tokenLoc(opTok);
    const op = tokenToOp(opTok);
    advance(s);
    const right = parseAddSub(s);
    left = { type: 'BinaryExpr', left, op, right, loc } as BinaryExpr;
  }
  return left;
}

function parseAddSub(s: ParserState): Expression {
  let left = parseMulDiv(s);
  while (current(s).type === TokenType.PLUS || current(s).type === TokenType.MINUS) {
    const opTok = current(s);
    const loc = tokenLoc(opTok);
    const op = opTok.type === TokenType.PLUS ? '+' : '-';
    advance(s);
    const right = parseMulDiv(s);
    left = { type: 'BinaryExpr', left, op, right, loc } as BinaryExpr;
  }
  return left;
}

function parseMulDiv(s: ParserState): Expression {
  let left = parseUnary(s);
  while (current(s).type === TokenType.STAR || current(s).type === TokenType.SLASH) {
    const opTok = current(s);
    const loc = tokenLoc(opTok);
    const op = opTok.type === TokenType.STAR ? '*' : '/';
    advance(s);
    const right = parseUnary(s);
    left = { type: 'BinaryExpr', left, op, right, loc } as BinaryExpr;
  }
  return left;
}

function parseUnary(s: ParserState): Expression {
  if (current(s).type === TokenType.NOT) {
    const loc = tokenLoc(current(s));
    advance(s);
    const operand = parseUnary(s);
    return { type: 'BinaryExpr', left: operand, op: 'not', right: operand, loc } as unknown as Expression;
  }
  if (current(s).type === TokenType.MINUS) {
    const loc = tokenLoc(current(s));
    advance(s);
    const operand = parseUnary(s);
    // Represent unary minus as a Literal if operand is number, else BinaryExpr
    if (operand.type === 'Literal' && typeof (operand as Literal).value === 'number') {
      return { type: 'Literal', value: -((operand as Literal).value as number), loc } as Literal;
    }
    return { type: 'BinaryExpr', left: { type: 'Literal', value: 0, loc } as Literal, op: '-', right: operand, loc } as BinaryExpr;
  }
  return parsePostfix(s);
}

/** Parse postfix: member access (obj.prop) */
function parsePostfix(s: ParserState): Expression {
  let expr = parsePrimaryExpr(s);

  while (current(s).type === TokenType.DOT && peekAt(s, 1).type === TokenType.IDENTIFIER) {
    const loc = tokenLoc(current(s));
    advance(s); // consume DOT
    const propTok = current(s);
    advance(s); // consume property name
    expr = { type: 'MemberAccess', object: expr, property: propTok.value, loc } as MemberAccess;
  }

  return expr;
}

/** Parse primary expressions: literals, identifiers, function calls, grouped, arrays. */
function parsePrimaryExpr(s: ParserState): Expression {
  const tok = current(s);

  // Number literal
  if (tok.type === TokenType.NUMBER) {
    advance(s);
    return {
      type: 'Literal',
      value: parseFloat(tok.value),
      loc: tokenLoc(tok),
    } as Literal;
  }

  // String literal
  if (tok.type === TokenType.STRING) {
    advance(s);
    return {
      type: 'Literal',
      value: tok.value,
      loc: tokenLoc(tok),
    } as Literal;
  }

  // Grouped expression: (expr)
  if (tok.type === TokenType.LPAREN) {
    advance(s); // consume '('
    const expr = parseExpression(s);
    if (current(s).type === TokenType.RPAREN) {
      advance(s); // consume ')'
    } else {
      s.errors.push(
        makeError(
          `Expected ')' after grouped expression`,
          tokenLoc(current(s)),
          `Add a closing ')'`,
        ),
      );
    }
    return expr;
  }

  // Array literal: [elem, ...]
  if (tok.type === TokenType.LBRACKET) {
    return parseArrayLiteral(s);
  }

  // Identifier or function call
  if (
    tok.type === TokenType.IDENTIFIER ||
    isKeywordUsableAsIdentifier(tok)
  ) {
    const loc = tokenLoc(tok);
    const name = tok.value;
    advance(s);

    // Function call: name(...)
    if (current(s).type === TokenType.LPAREN) {
      const args = parseFuncCallArgs(s);
      return { type: 'FuncCallExpr', callee: name, args, loc } as FuncCallExpr;
    }

    return { type: 'Identifier', name, loc } as Identifier;
  }

  // Unknown — synthesize error identifier
  const loc = tokenLoc(tok);
  s.errors.push(
    makeError(
      `Expected expression, got '${tok.value}'`,
      loc,
      `Provide a value, identifier, or expression`,
    ),
  );
  // Advance to avoid infinite loop
  if (tok.type !== TokenType.EOF) advance(s);
  return { type: 'Identifier', name: '__error__', loc } as Identifier;
}

function parseArrayLiteral(s: ParserState): ArrayLiteral {
  const loc = tokenLoc(current(s));
  advance(s); // consume '['
  const elements: Expression[] = [];

  while (current(s).type !== TokenType.RBRACKET && !atEnd(s)) {
    elements.push(parseExpression(s));
    if (current(s).type === TokenType.COMMA) {
      advance(s);
    } else {
      break;
    }
  }

  if (current(s).type === TokenType.RBRACKET) {
    advance(s); // consume ']'
  } else {
    s.errors.push(
      makeError(
        `Expected ']' to close array literal`,
        tokenLoc(current(s)),
        `Add a closing ']' after the last element`,
      ),
    );
  }

  return { type: 'ArrayLiteral', elements, loc };
}

/** Parse args for function call expression: (expr, expr, ...) */
function parseFuncCallArgs(s: ParserState): Expression[] {
  const args: Expression[] = [];
  advance(s); // consume '('

  if (current(s).type === TokenType.RPAREN) {
    advance(s);
    return args;
  }

  while (current(s).type !== TokenType.RPAREN && !atEnd(s)) {
    args.push(parseExpression(s));
    if (current(s).type === TokenType.COMMA) {
      advance(s);
    } else {
      break;
    }
  }

  if (current(s).type === TokenType.RPAREN) {
    advance(s);
  } else {
    s.errors.push(
      makeError(
        `Expected ')' to close function call`,
        tokenLoc(current(s)),
        `Add a closing ')'`,
      ),
    );
  }

  return args;
}

/** Some keywords can be used as identifiers in expression context. */
function isKeywordUsableAsIdentifier(tok: Token): boolean {
  return (
    tok.type === TokenType.MEASURE ||
    tok.type === TokenType.STATE ||
    tok.type === TokenType.EVENT ||
    tok.type === TokenType.CLAIM ||
    tok.type === TokenType.BOND ||
    tok.type === TokenType.PLAIN ||
    tok.type === TokenType.GATE ||
    tok.type === TokenType.PULSE ||
    tok.type === TokenType.CHAIN_KW ||
    tok.type === TokenType.MESH ||
    tok.type === TokenType.BLOOM ||
    tok.type === TokenType.FADE ||
    tok.type === TokenType.FORGE ||
    tok.type === TokenType.AGENT ||
    tok.type === TokenType.EVERY ||
    tok.type === TokenType.CONSECUTIVE ||
    tok.type === TokenType.SECONDS ||
    tok.type === TokenType.MINUTES ||
    tok.type === TokenType.HOURS ||
    tok.type === TokenType.DAYS
  );
}

// ---------------------------------------------------------------------------
// Operator helpers
// ---------------------------------------------------------------------------

function isComparisonOp(tok: Token): boolean {
  return (
    tok.type === TokenType.GT ||
    tok.type === TokenType.LT ||
    tok.type === TokenType.GTE ||
    tok.type === TokenType.LTE ||
    tok.type === TokenType.EQ
  );
}

function tokenToOp(tok: Token): string {
  switch (tok.type) {
    case TokenType.GT: return '>';
    case TokenType.LT: return '<';
    case TokenType.GTE: return '>=';
    case TokenType.LTE: return '<=';
    case TokenType.EQ: return '=';
    default: return tok.value;
  }
}

// ---------------------------------------------------------------------------
// Token navigation helpers
// ---------------------------------------------------------------------------

function current(s: ParserState): Token {
  return s.tokens[s.pos] ?? { type: TokenType.EOF, value: '', line: 0, column: 0, offset: 0 };
}

function peekAt(s: ParserState, offset: number): Token {
  return s.tokens[s.pos + offset] ?? { type: TokenType.EOF, value: '', line: 0, column: 0, offset: 0 };
}

function advance(s: ParserState): Token {
  const tok = current(s);
  if (s.pos < s.tokens.length) s.pos++;
  return tok;
}

function atEnd(s: ParserState): boolean {
  return current(s).type === TokenType.EOF;
}

function skipNewlines(s: ParserState): void {
  while (current(s).type === TokenType.NEWLINE) {
    s.pos++;
  }
}

/** Skip tokens until we're past a newline or at EOF (error recovery). */
function skipToNextLine(s: ParserState): void {
  while (current(s).type !== TokenType.NEWLINE && !atEnd(s)) {
    s.pos++;
  }
  if (current(s).type === TokenType.NEWLINE) s.pos++;
}

/** Consume an expected token type; emit error if not found. */
function expect(s: ParserState, type: TokenType): Token | null {
  if (current(s).type === type) {
    return advance(s);
  }
  s.errors.push(
    makeError(
      `Expected '${type}' but got '${current(s).value || current(s).type}'`,
      tokenLoc(current(s)),
      `Add '${type}' here`,
    ),
  );
  return null;
}

function tokenLoc(tok: Token): SourceLocation {
  return { line: tok.line, column: tok.column, offset: tok.offset };
}
