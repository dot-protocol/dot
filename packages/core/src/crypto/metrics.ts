/**
 * @module metrics
 * Self-awareness layer for the DOT crypto module.
 *
 * Every cryptographic operation records its own duration and count.
 * This gives the module the ability to report its own performance health.
 */

/** Accumulated stats for a single operation type. */
interface OperationStats {
  count: number;
  total_ms: number;
  avg_ms: number;
}

/** Full crypto metrics snapshot. */
export interface CryptoMetrics {
  sign: OperationStats;
  verify: OperationStats;
  hash: OperationStats;
}

type OpKey = keyof CryptoMetrics;

const state: Record<OpKey, { count: number; total_ms: number }> = {
  sign: { count: 0, total_ms: 0 },
  verify: { count: 0, total_ms: 0 },
  hash: { count: 0, total_ms: 0 },
};

/**
 * Record a completed operation and its duration.
 *
 * @param op   - The operation key: 'sign' | 'verify' | 'hash'
 * @param ms   - Duration in milliseconds (may be fractional via performance.now())
 */
export function recordOp(op: OpKey, ms: number): void {
  state[op].count += 1;
  state[op].total_ms += ms;
}

/**
 * Return a snapshot of all crypto operation metrics.
 * avg_ms is 0 when no operations have been recorded yet.
 *
 * @returns CryptoMetrics — sign / verify / hash stats
 */
export function getCryptoMetrics(): CryptoMetrics {
  const build = (op: OpKey): OperationStats => {
    const { count, total_ms } = state[op];
    return {
      count,
      total_ms,
      avg_ms: count === 0 ? 0 : total_ms / count,
    };
  };

  return {
    sign: build('sign'),
    verify: build('verify'),
    hash: build('hash'),
  };
}

/**
 * Reset all counters and accumulators to zero.
 * Useful between benchmark runs or test isolation.
 */
export function resetMetrics(): void {
  for (const op of Object.keys(state) as OpKey[]) {
    state[op].count = 0;
    state[op].total_ms = 0;
  }
}

/**
 * Wrap a synchronous function with automatic timing and metric recording.
 *
 * @param op  - The operation key to record against
 * @param fn  - The function to wrap
 * @returns The return value of fn
 */
export function timed<T>(op: OpKey, fn: () => T): T {
  const t0 = performance.now();
  const result = fn();
  recordOp(op, performance.now() - t0);
  return result;
}
