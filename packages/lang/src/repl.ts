/**
 * DOT Language REPL / runner.
 *
 * Provides three entry points:
 *   run(source)     → lex → parse → check → generateTypeScript → return TS string
 *   explain(source) → lex → parse → generateEnglish → return English string
 *   check(source)   → lex → parse → checkProgram → return {errors, warnings}
 *
 * Each function is synchronous and self-contained — no external state.
 */

import { lex } from './lexer.js';
import { parse } from './parser.js';
import { checkProgram } from './checker.js';
import { generateTypeScript } from './codegen/typescript.js';
import { generateEnglish } from './codegen/english.js';
import type { SemanticError, CheckResult } from './checker.js';
import { formatErrors } from './errors.js';

/**
 * Run a DOT source string through the full pipeline and return generated TypeScript.
 *
 * Pipeline: lex → parse → check (halt on semantic errors) → generateTypeScript
 *
 * @param source - Raw DOT source code
 * @returns Generated TypeScript source string
 * @throws Error if there are lex, parse, or semantic errors
 *
 * @example
 * const ts = run('observe temperature at sensor(7) = 82.3');
 * // Returns: import { observe, sign, chain } from '@dot-protocol/core'; ...
 */
export function run(source: string): string {
  // 1. Lex
  const { tokens, errors: lexErrors } = lex(source);
  if (lexErrors.length > 0) {
    throw new Error(`Lex errors:\n${formatErrors(source, lexErrors)}`);
  }

  // 2. Parse
  const { ast, errors: parseErrors } = parse(tokens, source);
  if (parseErrors.length > 0) {
    throw new Error(`Parse errors:\n${formatErrors(source, parseErrors)}`);
  }

  // 3. Check
  const { errors: semanticErrors } = checkProgram(ast);
  if (semanticErrors.length > 0) {
    const msgs = semanticErrors.map(e => `  ${e.line}:${e.column} — ${e.message}`).join('\n');
    throw new Error(`Semantic errors:\n${msgs}`);
  }

  // 4. Generate TypeScript
  return generateTypeScript(ast);
}

/**
 * Explain a DOT source string in human-readable English.
 *
 * Pipeline: lex → parse → generateEnglish
 *
 * @param source - Raw DOT source code
 * @returns English description of the program
 * @throws Error if there are lex or parse errors
 *
 * @example
 * const english = explain('observe temperature at sensor(7) = 82.3');
 * // Returns: "Observe the temperature at sensor(7) (82.3)."
 */
export function explain(source: string): string {
  // 1. Lex
  const { tokens, errors: lexErrors } = lex(source);
  if (lexErrors.length > 0) {
    throw new Error(`Lex errors:\n${formatErrors(source, lexErrors)}`);
  }

  // 2. Parse
  const { ast, errors: parseErrors } = parse(tokens, source);
  if (parseErrors.length > 0) {
    throw new Error(`Parse errors:\n${formatErrors(source, parseErrors)}`);
  }

  // 3. Generate English
  return generateEnglish(ast);
}

/**
 * Check a DOT source string for semantic errors.
 *
 * Pipeline: lex → parse → checkProgram
 *
 * @param source - Raw DOT source code
 * @returns CheckResult with errors and warnings arrays
 *
 * @example
 * const result = check('observe temperature .gate(temperature)');
 * if (result.errors.length > 0) { ... }
 */
export function check(source: string): CheckResult {
  // 1. Lex — collect errors but don't throw (return them as semantic errors)
  const { tokens, errors: lexErrors } = lex(source);

  if (lexErrors.length > 0) {
    return {
      errors: lexErrors.map(e => ({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      } as SemanticError)),
      warnings: [],
    };
  }

  // 2. Parse — collect errors but don't throw
  const { ast, errors: parseErrors } = parse(tokens, source);

  if (parseErrors.length > 0) {
    return {
      errors: parseErrors.map(e => ({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      } as SemanticError)),
      warnings: [],
    };
  }

  // 3. Semantic check
  return checkProgram(ast);
}
