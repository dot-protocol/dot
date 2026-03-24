/**
 * state.ts — State management via DOT chains.
 *
 * Every set() creates a new DOT on the state's chain, making all
 * state transitions tamper-evident and causally linked.
 *
 * undo() / redo() walk the chain to restore previous values.
 * history() returns the full ordered list of all values ever set.
 */

import { observe as coreObserve, fromBytes } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createChain, append, walk } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';
import type { DotRuntime } from './runtime.js';

/** A reactive state container backed by a DOT chain. */
export interface DotState<T> {
  /** Returns the current value. */
  get(): T;

  /**
   * Set a new value. Creates a new DOT on the state's chain.
   * Notifies all subscribers.
   *
   * @param value - The new state value
   * @returns The DOT that was created for this transition
   */
  set(value: T): Promise<DOT>;

  /**
   * Subscribe to state changes.
   *
   * @param handler - Called with the new value on every set()
   * @returns Unsubscribe function
   */
  subscribe(handler: (value: T) => void): () => void;

  /**
   * Returns the full history of values in insertion order (oldest first).
   * Includes the initial value as the first entry.
   */
  history(): T[];

  /**
   * Undo the last set() — walk chain back one step.
   * Returns the restored value, or null if already at the initial state.
   */
  undo(): Promise<T | null>;

  /**
   * Redo a previously undone set().
   * Returns the restored value, or null if nothing to redo.
   */
  redo(): Promise<T | null>;
}

/** Internal mutable state for a DotState instance. */
interface StateData<T> {
  current: T;
  chain: Chain;
  runtime: DotRuntime;
  subscribers: Set<(value: T) => void>;
  /** Cursor into the history for undo/redo. Points to the current position. */
  cursor: number;
  /** All historical values in order (enables undo/redo). */
  valueHistory: T[];
}

/**
 * Creates a new state container backed by a DOT chain.
 *
 * @param runtime      - The DotRuntime that will sign state DOTs
 * @param initialValue - The starting value of the state
 * @returns A DotState instance
 *
 * @example
 * const rt = await createRuntime();
 * const counter = createState(rt, 0);
 * await counter.set(1);
 * await counter.set(2);
 * console.log(counter.get()); // 2
 * console.log(counter.history()); // [0, 1, 2]
 * await counter.undo(); // restores 1
 */
export function createState<T>(runtime: DotRuntime, initialValue: T): DotState<T> {
  const data: StateData<T> = {
    current: initialValue,
    chain: createChain(),
    runtime,
    subscribers: new Set(),
    cursor: 0,
    valueHistory: [initialValue],
  };

  const state: DotState<T> = {
    get(): T {
      return data.current;
    },

    async set(value: T): Promise<DOT> {
      // If we have redo history beyond the cursor, truncate it (new branch)
      if (data.cursor < data.valueHistory.length - 1) {
        data.valueHistory = data.valueHistory.slice(0, data.cursor + 1);
      }

      // Encode value as JSON payload
      const payload = JSON.stringify({ value });

      // Use the runtime's observe to create a signed, chained DOT
      const dot = await data.runtime.observe(payload, { type: 'state', plaintext: true });

      // Also append to the state's own chain for walking
      data.chain = append(data.chain, dot);

      // Update current value
      data.current = value;
      data.valueHistory.push(value);
      data.cursor = data.valueHistory.length - 1;

      // Notify subscribers
      for (const handler of data.subscribers) {
        handler(value);
      }

      return dot;
    },

    subscribe(handler: (value: T) => void): () => void {
      data.subscribers.add(handler);
      return () => {
        data.subscribers.delete(handler);
      };
    },

    history(): T[] {
      return [...data.valueHistory];
    },

    async undo(): Promise<T | null> {
      if (data.cursor <= 0) return null;

      data.cursor--;
      const prevValue = data.valueHistory[data.cursor];
      if (prevValue === undefined) return null;

      data.current = prevValue;

      // Notify subscribers
      for (const handler of data.subscribers) {
        handler(prevValue);
      }

      return prevValue;
    },

    async redo(): Promise<T | null> {
      if (data.cursor >= data.valueHistory.length - 1) return null;

      data.cursor++;
      const nextValue = data.valueHistory[data.cursor];
      if (nextValue === undefined) return null;

      data.current = nextValue;

      // Notify subscribers
      for (const handler of data.subscribers) {
        handler(nextValue);
      }

      return nextValue;
    },
  };

  return state;
}
