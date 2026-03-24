/**
 * reactive.ts — Reactive observation streams.
 *
 * A DotStream is a composable pipeline of DOT observations.
 * Each emit() chains to the previous emission on the stream.
 * Streams can be filtered, mapped, and composed.
 */

import type { DOT, ObservationType } from '@dot-protocol/core';
import type { DotRuntime } from './runtime.js';

/** Options for creating a DotStream. */
export interface StreamOpts {
  /** Optional name/label for this stream (informational). */
  name?: string;
  /** Default observation type for emitted DOTs. */
  defaultType?: ObservationType;
}

/** A composable, reactive stream of DOT observations. */
export interface DotStream {
  /**
   * Emit a payload on this stream.
   *
   * Creates a new DOT via the runtime and chains it to the previous
   * emission on this stream.
   *
   * @param payload - Value to emit
   * @param type    - Optional observation type override
   * @returns The created DOT
   */
  emit(payload: unknown, type?: ObservationType): Promise<DOT>;

  /**
   * Register a handler called on every new emission.
   *
   * @param handler - Called with each emitted DOT
   * @returns Unsubscribe function
   */
  on(handler: (dot: DOT) => void): () => void;

  /**
   * Create a derived stream that only passes DOTs matching a predicate.
   *
   * @param predicate - Returns true to keep the DOT
   * @returns A new filtered DotStream
   */
  filter(predicate: (dot: DOT) => boolean): DotStream;

  /**
   * Create a derived stream that transforms each DOT.
   *
   * @param transform - Maps each DOT to a new DOT
   * @returns A new mapped DotStream
   */
  map(transform: (dot: DOT) => DOT): DotStream;

  /**
   * Returns the most recently emitted DOT, or null if nothing emitted yet.
   */
  latest(): DOT | null;

  /**
   * Returns the total number of DOTs emitted on this stream.
   */
  count(): number;
}

/** Internal state for a DotStream. */
interface StreamState {
  runtime: DotRuntime;
  opts: StreamOpts;
  handlers: Set<(dot: DOT) => void>;
  latestDot: DOT | null;
  emitCount: number;
}

/**
 * Creates a new reactive DOT stream.
 *
 * @param runtime - The DotRuntime used for signing observations
 * @param opts    - Optional stream configuration
 * @returns A DotStream
 *
 * @example
 * const rt = await createRuntime();
 * const stream = createStream(rt);
 * stream.on(dot => console.log('got dot', dot));
 * await stream.emit('hello', 'event');
 *
 * @example
 * // Composable filter + map
 * const measures = stream
 *   .filter(d => d.type === 'measure')
 *   .map(d => ({ ...d, type: 'state' }));
 */
export function createStream(runtime: DotRuntime, opts?: StreamOpts): DotStream {
  const state: StreamState = {
    runtime,
    opts: opts ?? {},
    handlers: new Set(),
    latestDot: null,
    emitCount: 0,
  };

  return buildStream(state);
}

/** Construct a DotStream from a StreamState. */
function buildStream(state: StreamState): DotStream {
  const stream: DotStream = {
    async emit(payload: unknown, type?: ObservationType): Promise<DOT> {
      const effectiveType = type ?? state.opts.defaultType;

      const dot = await state.runtime.observe(payload, {
        type: effectiveType,
        plaintext: true,
      });

      state.latestDot = dot;
      state.emitCount++;

      // Notify handlers
      for (const handler of state.handlers) {
        handler(dot);
      }

      return dot;
    },

    on(handler: (dot: DOT) => void): () => void {
      state.handlers.add(handler);
      return () => {
        state.handlers.delete(handler);
      };
    },

    filter(predicate: (dot: DOT) => boolean): DotStream {
      // Create a derived stream that only passes matching DOTs
      const derivedState: StreamState = {
        runtime: state.runtime,
        opts: state.opts,
        handlers: new Set(),
        latestDot: null,
        emitCount: 0,
      };

      const derived = buildStream(derivedState);

      // Subscribe to the parent stream and forward only matching DOTs
      state.handlers.add((dot) => {
        if (predicate(dot)) {
          derivedState.latestDot = dot;
          derivedState.emitCount++;
          for (const handler of derivedState.handlers) {
            handler(dot);
          }
        }
      });

      return derived;
    },

    map(transform: (dot: DOT) => DOT): DotStream {
      // Create a derived stream that transforms each DOT
      const derivedState: StreamState = {
        runtime: state.runtime,
        opts: state.opts,
        handlers: new Set(),
        latestDot: null,
        emitCount: 0,
      };

      const derived = buildStream(derivedState);

      // Subscribe to the parent stream and forward transformed DOTs
      state.handlers.add((dot) => {
        const transformed = transform(dot);
        derivedState.latestDot = transformed;
        derivedState.emitCount++;
        for (const handler of derivedState.handlers) {
          handler(transformed);
        }
      });

      return derived;
    },

    latest(): DOT | null {
      return state.latestDot;
    },

    count(): number {
      return state.emitCount;
    },
  };

  return stream;
}
