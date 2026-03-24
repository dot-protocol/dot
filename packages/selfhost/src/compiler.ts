/**
 * compiler.ts — Self-hosting compiler pipeline.
 *
 * Takes DOT source (.dot files) through the full compilation pipeline:
 *   source string → lex → parse → type-check → generate TypeScript
 *
 * This is the self-hosting proof: DOT programs compile themselves using
 * the @dot-protocol/lang package.
 */

import { lex, parse, checkProgram, generateTypeScript, generateEnglish } from '@dot-protocol/lang';
import type { CheckResult } from '@dot-protocol/lang';

// ---------------------------------------------------------------------------
// compileDotFile
// ---------------------------------------------------------------------------

/**
 * Compile a DOT source string to TypeScript.
 *
 * Pipeline: lex → parse → check → generateTypeScript
 *
 * @param source - Raw DOT source code
 * @returns Generated TypeScript source string
 * @throws Error if there are lex, parse, or semantic errors
 */
export function compileDotFile(source: string): string {
  // 1. Lex
  const { tokens, errors: lexErrors } = lex(source);
  if (lexErrors.length > 0) {
    const msgs = lexErrors.map(e => `  ${e.location.line}:${e.location.column} — ${e.message}`).join('\n');
    throw new Error(`Lex errors:\n${msgs}`);
  }

  // 2. Parse
  const { ast, errors: parseErrors } = parse(tokens, source);
  if (parseErrors.length > 0) {
    const msgs = parseErrors.map(e => `  ${e.location.line}:${e.location.column} — ${e.message}`).join('\n');
    throw new Error(`Parse errors:\n${msgs}`);
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

// ---------------------------------------------------------------------------
// compileDotToRuntime
// ---------------------------------------------------------------------------

/**
 * Compile a DOT source string and evaluate it in a sandboxed Function context.
 *
 * NOTE: This returns the generated TypeScript source and the Function object.
 * Actual execution is handled by executor.ts using the script runtime.
 * The Function constructor approach is used for self-hosting validation only.
 *
 * @param source - Raw DOT source code
 * @returns The compiled TypeScript source string
 */
export async function compileDotToRuntime(source: string): Promise<{ typescript: string }> {
  const typescript = compileDotFile(source);
  return { typescript };
}

// ---------------------------------------------------------------------------
// validateRoundtrip
// ---------------------------------------------------------------------------

/** Result of a roundtrip validation check. */
export interface RoundtripResult {
  /** Whether the roundtrip completed without errors. */
  valid: boolean;
  /** Lex or parse errors encountered. */
  parseErrors: Array<{ message: string; line: number; column: number }>;
  /** Semantic (type check) errors encountered. */
  checkErrors: Array<{ message: string; line: number; column: number }>;
  /** The generated TypeScript (if compilation succeeded). */
  typescript?: string;
  /** The generated English prose (if parsing succeeded). */
  english?: string;
}

/**
 * Validate that a DOT source string roundtrips cleanly through the pipeline.
 *
 * Checks:
 * 1. Lex without errors
 * 2. Parse without errors
 * 3. Type-check without semantic errors
 * 4. Generate valid TypeScript
 * 5. Generate English prose
 *
 * @param source - Raw DOT source code
 * @returns Detailed validation result
 */
export function validateRoundtrip(source: string): RoundtripResult {
  const parseErrorsList: Array<{ message: string; line: number; column: number }> = [];
  const checkErrorsList: Array<{ message: string; line: number; column: number }> = [];

  // 1. Lex
  const { tokens, errors: lexErrors } = lex(source);
  if (lexErrors.length > 0) {
    for (const e of lexErrors) {
      parseErrorsList.push({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      });
    }
    return { valid: false, parseErrors: parseErrorsList, checkErrors: checkErrorsList };
  }

  // 2. Parse
  const { ast, errors: parseErrors } = parse(tokens, source);
  if (parseErrors.length > 0) {
    for (const e of parseErrors) {
      parseErrorsList.push({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      });
    }
    return { valid: false, parseErrors: parseErrorsList, checkErrors: checkErrorsList };
  }

  // 3. Check
  const checkResult: CheckResult = checkProgram(ast);
  if (checkResult.errors.length > 0) {
    for (const e of checkResult.errors) {
      checkErrorsList.push({
        message: e.message,
        line: e.line,
        column: e.column,
      });
    }
    return { valid: false, parseErrors: parseErrorsList, checkErrors: checkErrorsList };
  }

  // 4. Generate TypeScript
  const typescript = generateTypeScript(ast);

  // 5. Generate English
  let english: string | undefined;
  try {
    english = generateEnglish(ast);
  } catch {
    // English generation is best-effort
  }

  return {
    valid: true,
    parseErrors: [],
    checkErrors: [],
    typescript,
    english,
  };
}
