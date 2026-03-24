/**
 * DOT Language Error Types — R854.
 *
 * Structured errors with source location and suggestions.
 * formatError() produces a human-readable error with a "^" pointer to the problem.
 */

// Import and re-export SourceLocation from ast for use in error construction
import type { SourceLocation } from './ast.js';
export type { SourceLocation };

/** Severity of a parse/lex error. */
export type ErrorSeverity = 'error' | 'warning';

/** A DOT language parse or lex error. */
export interface DotError {
  /** Human-readable error message. */
  message: string;
  /** Source location where the error occurred. */
  location: SourceLocation;
  /** Suggested fix or explanation, if available. */
  suggestion?: string;
  /** Severity (default: 'error'). */
  severity: ErrorSeverity;
}

/**
 * Create a DotError with optional suggestion.
 */
export function makeError(
  message: string,
  location: SourceLocation,
  suggestion?: string,
  severity: ErrorSeverity = 'error',
): DotError {
  return { message, location, suggestion, severity };
}

/**
 * Format a DotError into a human-readable string showing the offending line
 * with a "^" caret pointing at the error column.
 *
 * @param source - Full source text
 * @param error - The error to format
 * @returns Multiline string with location, message, line preview, caret, and optional suggestion
 */
export function formatError(source: string, error: DotError): string {
  const lines = source.split('\n');
  const lineIndex = error.location.line - 1;
  const sourceLine = (lineIndex >= 0 && lineIndex < lines.length) ? (lines[lineIndex] ?? '') : '';
  const col = Math.max(0, error.location.column - 1);
  const caret = ' '.repeat(col) + '^';

  const parts: string[] = [
    `${error.severity.toUpperCase()} at line ${error.location.line}, column ${error.location.column}:`,
    `  ${error.message}`,
    `    ${sourceLine}`,
    `    ${caret}`,
  ];

  if (error.suggestion) {
    parts.push(`  Suggestion: ${error.suggestion}`);
  }

  return parts.join('\n');
}

/**
 * Aggregate multiple errors into a single formatted message.
 */
export function formatErrors(source: string, errors: DotError[]): string {
  return errors.map((e) => formatError(source, e)).join('\n\n');
}
