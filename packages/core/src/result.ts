/**
 * result.ts — Result type for DOT Protocol.
 *
 * R855: Every function that can fail returns Result<T, DOTError>.
 * No thrown exceptions in library code.
 *
 * Result<T, E> is a discriminated union:
 *   { ok: true; value: T }  — success
 *   { ok: false; error: E } — failure
 */

/**
 * Standard error type for DOT Protocol operations.
 */
export interface DOTError {
  /** Machine-readable error code, e.g. 'VERIFY_FAILED', 'DECODE_MALFORMED', 'SIGN_INVALID_KEY'. */
  code: string;
  /** Human-readable description of what went wrong. */
  message: string;
  /** Package or function that produced the error. */
  source?: string;
  /** Additional context — raw error, bad bytes, etc. */
  details?: unknown;
}

/**
 * Result<T, E> — a discriminated union representing success or failure.
 *
 * @template T - The success value type
 * @template E - The error type (defaults to DOTError)
 */
export type Result<T, E = DOTError> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Construct a successful Result.
 *
 * @param value - The success value
 * @returns Result with ok: true
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Construct a failed Result.
 *
 * @param error - The error value
 * @returns Result with ok: false
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Type guard — narrows Result to its success branch.
 *
 * @param result - The Result to check
 * @returns true if result is { ok: true; value: T }
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard — narrows Result to its error branch.
 *
 * @param result - The Result to check
 * @returns true if result is { ok: false; error: E }
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Extract the value from a successful Result, or throw if it's an error.
 *
 * Use this at the boundary between library code (which returns Result) and
 * application code (which may prefer exceptions).
 *
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws {Error} If the result is an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Unwrap on error: ${JSON.stringify(result.error)}`);
}

/**
 * Extract the value from a successful Result, or return a default value.
 *
 * @param result - The Result to unwrap
 * @param defaultValue - Value to return if result is an error
 * @returns The success value or defaultValue
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}
