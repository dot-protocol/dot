/**
 * scheduler.ts — Agent-style periodic observations.
 *
 * createAgent() schedules a task to run on a fixed interval.
 * Each execution emits a DOT to the agent's chain.
 *
 * This is what `agent {} every 5 seconds {}` in the DOT language compiles to.
 */

import { observe as coreObserve } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { DotRuntime } from './runtime.js';

/** Time unit for agent scheduling. */
export type TimeUnit = 'seconds' | 'minutes' | 'hours';

/** Configuration for a periodic agent. */
export interface AgentConfig {
  /** Human-readable agent name (used in emitted DOTs). */
  name: string;
  /** How often to run the task. */
  every: {
    value: number;
    unit: TimeUnit;
  };
  /** The task to run on each execution. Called with the runtime. */
  task: (runtime: DotRuntime) => Promise<void>;
}

/** Handle for controlling a running agent. */
export interface DotAgent {
  /** Start the agent. Begins executing the task at the configured interval. */
  start(): void;

  /** Stop the agent. Prevents any further executions. */
  stop(): void;

  /** Returns true if the agent is currently running (started and not stopped). */
  isRunning(): boolean;

  /** Returns the total number of task executions completed. */
  executions(): number;
}

/** Convert an interval config to milliseconds. */
function toMs(value: number, unit: TimeUnit): number {
  switch (unit) {
    case 'seconds':
      return value * 1000;
    case 'minutes':
      return value * 60 * 1000;
    case 'hours':
      return value * 60 * 60 * 1000;
  }
}

/**
 * Creates a periodic DOT agent.
 *
 * The agent runs `config.task` on the configured interval.
 * Each execution emits an 'event' DOT to the runtime's chain recording
 * the agent name and execution number.
 *
 * Use vi.useFakeTimers() in tests to control the clock.
 *
 * @param runtime - The DotRuntime to emit DOTs to
 * @param config  - Agent name, schedule, and task function
 * @returns A DotAgent handle with start/stop/isRunning/executions
 *
 * @example
 * const agent = createAgent(runtime, {
 *   name: 'heartbeat',
 *   every: { value: 5, unit: 'seconds' },
 *   task: async (rt) => {
 *     await rt.observe('tick', { type: 'event' });
 *   },
 * });
 * agent.start();
 * // ... later
 * agent.stop();
 */
export function createAgent(runtime: DotRuntime, config: AgentConfig): DotAgent {
  let running = false;
  let executionCount = 0;
  let timerId: ReturnType<typeof setInterval> | null = null;

  const intervalMs = toMs(config.every.value, config.every.unit);

  function runExecution(): void {
    executionCount++;
    const execNum = executionCount;

    // Run the user's task (fire-and-forget, non-blocking)
    // Task runs first so test callbacks can track it synchronously via microtasks.
    // DOT emission is best-effort after the task.
    Promise.resolve()
      .then(async () => {
        // Run the user's task first
        await config.task(runtime);
      })
      .catch(() => {
        // Task errors swallowed to keep the agent running
      });

    // Emit a DOT in the background to record this execution
    runtime
      .observe(
        {
          agent: config.name,
          execution: execNum,
          interval_ms: intervalMs,
          timestamp: Date.now(),
        },
        { type: 'event', plaintext: true },
      )
      .catch(() => {
        // Best-effort — ignore failures
      });
  }

  const agent: DotAgent = {
    start(): void {
      if (running) return;
      running = true;

      timerId = setInterval(() => {
        runExecution();
      }, intervalMs);
    },

    stop(): void {
      if (!running) return;
      running = false;

      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    },

    isRunning(): boolean {
      return running;
    },

    executions(): number {
      return executionCount;
    },
  };

  return agent;
}
