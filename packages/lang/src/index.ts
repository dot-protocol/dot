/**
 * @dot-protocol/lang — DOT Language Lexer, Parser, and AST.
 *
 * R854: The DOT observation language.
 *
 * Usage:
 *   import { lex, parse } from '@dot-protocol/lang';
 *   const { tokens } = lex(source);
 *   const { ast, errors } = parse(tokens, source);
 */

// Lexer
export { lex } from './lexer.js';
export type { LexResult } from './lexer.js';

// Parser
export { parse } from './parser.js';
export type { ParseResult } from './parser.js';

// AST types
export type {
  Program,
  Statement,
  ObserveStatement,
  AgentStatement,
  FunctionCall,
  Expression,
  NamedArg,
  BinaryExpr,
  UnaryExpr,
  Literal,
  Identifier,
  FuncCallExpr,
  MemberAccess,
  ArrayLiteral,
  SourceLocation,
} from './ast.js';

// Token types
export { TokenType, KEYWORDS, FUNCTION_CHAIN_KEYWORDS, TIME_UNIT_KEYWORDS } from './tokens.js';
export type { Token } from './tokens.js';

// Error types + utilities
export { makeError, formatError, formatErrors } from './errors.js';
export type { DotError, ErrorSeverity } from './errors.js';

// Type checker
export { checkProgram } from './checker.js';
export type { CheckResult, SemanticError } from './checker.js';

// Code generators
export { generateTypeScript } from './codegen/typescript.js';
export { generateEnglish } from './codegen/english.js';

// REPL / runner
export { run, explain, check } from './repl.js';

// AST extra types
export type { ObserveType } from './ast.js';
