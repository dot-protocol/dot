/**
 * validator.ts — Validate self-hosting DOT programs.
 *
 * Validates that DOT programs satisfy the self-hosting contract:
 * 1. Parse without errors
 * 2. Type-check without errors
 * 3. Generate valid TypeScript
 * 4. The generated TypeScript contains expected structure
 */

import { lex, parse, checkProgram, generateTypeScript } from '@dot-protocol/lang';

// ---------------------------------------------------------------------------
// ValidationResult
// ---------------------------------------------------------------------------

/** Result of validating a single DOT program. */
export interface ValidationResult {
  /** Whether all checks passed. */
  valid: boolean;
  /** Whether the program parsed without errors. */
  parsed: boolean;
  /** Whether the program type-checked without semantic errors. */
  typeChecked: boolean;
  /** Whether TypeScript code was generated successfully. */
  compiled: boolean;
  /** Whether the generated TypeScript has expected imports. */
  hasExpectedImports: boolean;
  /** Parse errors. */
  parseErrors: Array<{ message: string; line: number; column: number }>;
  /** Semantic errors. */
  semanticErrors: Array<{ message: string; line: number; column: number }>;
  /** Generated TypeScript (if compilation succeeded). */
  typescript?: string;
  /** Error message for compilation failures. */
  compilationError?: string;
}

// ---------------------------------------------------------------------------
// validateProgram
// ---------------------------------------------------------------------------

/**
 * Validate a DOT source string through all compilation stages.
 *
 * @param source - Raw DOT source code
 * @returns Detailed validation result with per-stage pass/fail
 */
export function validateProgram(source: string): ValidationResult {
  const parseErrorsList: Array<{ message: string; line: number; column: number }> = [];
  const semanticErrorsList: Array<{ message: string; line: number; column: number }> = [];

  // Stage 1: Lex
  const { tokens, errors: lexErrors } = lex(source);
  if (lexErrors.length > 0) {
    for (const e of lexErrors) {
      parseErrorsList.push({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      });
    }
    return {
      valid: false,
      parsed: false,
      typeChecked: false,
      compiled: false,
      hasExpectedImports: false,
      parseErrors: parseErrorsList,
      semanticErrors: semanticErrorsList,
    };
  }

  // Stage 2: Parse
  const { ast, errors: parseErrors } = parse(tokens, source);
  if (parseErrors.length > 0) {
    for (const e of parseErrors) {
      parseErrorsList.push({
        message: e.message,
        line: e.location.line,
        column: e.location.column,
      });
    }
    return {
      valid: false,
      parsed: false,
      typeChecked: false,
      compiled: false,
      hasExpectedImports: false,
      parseErrors: parseErrorsList,
      semanticErrors: semanticErrorsList,
    };
  }

  // Stage 3: Type-check
  const checkResult = checkProgram(ast);
  if (checkResult.errors.length > 0) {
    for (const e of checkResult.errors) {
      semanticErrorsList.push({ message: e.message, line: e.line, column: e.column });
    }
    return {
      valid: false,
      parsed: true,
      typeChecked: false,
      compiled: false,
      hasExpectedImports: false,
      parseErrors: [],
      semanticErrors: semanticErrorsList,
    };
  }

  // Stage 4: Generate TypeScript
  let typescript: string;
  let compilationError: string | undefined;
  try {
    typescript = generateTypeScript(ast);
  } catch (err) {
    compilationError = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      parsed: true,
      typeChecked: true,
      compiled: false,
      hasExpectedImports: false,
      parseErrors: [],
      semanticErrors: [],
      compilationError,
    };
  }

  // Stage 5: Check expected imports
  const hasExpectedImports = typescript.includes("@dot-protocol/core");

  return {
    valid: true,
    parsed: true,
    typeChecked: true,
    compiled: true,
    hasExpectedImports,
    parseErrors: [],
    semanticErrors: [],
    typescript,
  };
}

// ---------------------------------------------------------------------------
// SelfHostingScore
// ---------------------------------------------------------------------------

/** Score report for a batch of DOT programs. */
export interface SelfHostingScore {
  /** Total number of programs evaluated. */
  total: number;
  /** Number that parsed without errors. */
  parsed: number;
  /** Number that type-checked without errors. */
  checked: number;
  /** Number that compiled to TypeScript. */
  compiled: number;
  /** Number that were executed (externally tracked). */
  executed: number;
  /** Score percentage (0–100). */
  scorePercent: number;
  /** Per-program results. */
  results: Array<{ source: string; result: ValidationResult }>;
}

/**
 * Compute a self-hosting score across a batch of DOT programs.
 *
 * @param programs - Array of DOT source strings
 * @param executedCount - How many were also successfully executed (from executor)
 * @returns Comprehensive score report
 */
export function selfHostingScore(
  programs: string[],
  executedCount = 0,
): SelfHostingScore {
  const results: Array<{ source: string; result: ValidationResult }> = [];
  let parsed = 0;
  let checked = 0;
  let compiled = 0;

  for (const source of programs) {
    const result = validateProgram(source);
    results.push({ source, result });

    if (result.parsed) parsed++;
    if (result.typeChecked) checked++;
    if (result.compiled) compiled++;
  }

  const total = programs.length;
  // Score = average of 4 stages: parse, check, compile, execute
  const executed = Math.min(executedCount, total);
  const stageSum = parsed + checked + compiled + executed;
  const maxScore = total * 4;
  const scorePercent = maxScore === 0 ? 100 : Math.round((stageSum / maxScore) * 100);

  return {
    total,
    parsed,
    checked,
    compiled,
    executed,
    scorePercent,
    results,
  };
}
