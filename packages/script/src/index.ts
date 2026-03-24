/**
 * @dot-protocol/script — Lightweight DOT runtime for Node.js.
 *
 * A ~50KB target runtime managing identity, chain state, mesh connections,
 * and a reactive observation system.
 *
 * Primary entry point: createRuntime()
 *
 * @example
 * import { createRuntime, createState, createStream, createAgent, runtimeHealth } from '@dot-protocol/script';
 *
 * const rt = await createRuntime();
 * const dot = await rt.observe('hello world', { type: 'event' });
 * await rt.shutdown();
 */

// Runtime lifecycle
export { createRuntime } from './runtime.js';
export type { DotRuntime, RuntimeConfig, RuntimeObserveOptions } from './runtime.js';

// State management
export { createState } from './state.js';
export type { DotState } from './state.js';

// Reactive streams
export { createStream } from './reactive.js';
export type { DotStream, StreamOpts } from './reactive.js';

// Scheduler (periodic agents)
export { createAgent } from './scheduler.js';
export type { DotAgent, AgentConfig, TimeUnit } from './scheduler.js';

// Health
export { runtimeHealth } from './health.js';
export type { HealthPayload } from './health.js';
