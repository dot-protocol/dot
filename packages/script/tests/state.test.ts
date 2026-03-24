/**
 * state.test.ts — DotState tests.
 * Target: 25+ tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { createState } from '../src/state.js';
import type { DotRuntime } from '../src/runtime.js';

let runtime: DotRuntime;

beforeEach(async () => {
  runtime = await createRuntime();
});

// ─────────────────────────────────────────────
// createState — initial value
// ─────────────────────────────────────────────

describe('createState — initial value', () => {
  it('get() returns the initial value', () => {
    const s = createState(runtime, 42);
    expect(s.get()).toBe(42);
  });

  it('get() returns string initial value', () => {
    const s = createState(runtime, 'hello');
    expect(s.get()).toBe('hello');
  });

  it('get() returns object initial value', () => {
    const obj = { x: 1, y: 2 };
    const s = createState(runtime, obj);
    expect(s.get()).toEqual(obj);
  });

  it('history() returns [initial] before any set()', () => {
    const s = createState(runtime, 10);
    expect(s.history()).toEqual([10]);
  });
});

// ─────────────────────────────────────────────
// set()
// ─────────────────────────────────────────────

describe('set()', () => {
  it('set() updates the current value', async () => {
    const s = createState(runtime, 0);
    await s.set(5);
    expect(s.get()).toBe(5);
  });

  it('set() returns a DOT', async () => {
    const s = createState(runtime, 'a');
    const dot = await s.set('b');
    expect(dot).toBeDefined();
    expect(dot.sign?.signature).toBeDefined();
  });

  it('successive set() calls update value each time', async () => {
    const s = createState(runtime, 0);
    await s.set(1);
    await s.set(2);
    await s.set(3);
    expect(s.get()).toBe(3);
  });

  it('set() with object value works', async () => {
    const s = createState(runtime, { count: 0 });
    await s.set({ count: 1 });
    expect(s.get()).toEqual({ count: 1 });
  });

  it('each set() produces a signed DOT', async () => {
    const s = createState(runtime, 'x');
    const dot = await s.set('y');
    expect(dot.sign?.signature).toBeInstanceOf(Uint8Array);
  });
});

// ─────────────────────────────────────────────
// subscribe()
// ─────────────────────────────────────────────

describe('subscribe()', () => {
  it('subscribe fires on set()', async () => {
    const s = createState(runtime, 0);
    const received: number[] = [];
    s.subscribe((v) => received.push(v));
    await s.set(1);
    expect(received).toEqual([1]);
  });

  it('subscribe fires with the new value', async () => {
    const s = createState(runtime, 'start');
    let last = '';
    s.subscribe((v) => { last = v; });
    await s.set('end');
    expect(last).toBe('end');
  });

  it('multiple subscribers all fire', async () => {
    const s = createState(runtime, 0);
    let a = 0, b = 0;
    s.subscribe((v) => { a = v; });
    s.subscribe((v) => { b = v; });
    await s.set(99);
    expect(a).toBe(99);
    expect(b).toBe(99);
  });

  it('unsubscribe stops notifications', async () => {
    const s = createState(runtime, 0);
    const received: number[] = [];
    const unsub = s.subscribe((v) => received.push(v));
    await s.set(1);
    unsub();
    await s.set(2);
    expect(received).toEqual([1]);
  });

  it('unsubscribing one does not affect others', async () => {
    const s = createState(runtime, 0);
    const a: number[] = [];
    const b: number[] = [];
    const unsub = s.subscribe((v) => a.push(v));
    s.subscribe((v) => b.push(v));
    await s.set(1);
    unsub();
    await s.set(2);
    expect(a).toEqual([1]);
    expect(b).toEqual([1, 2]);
  });
});

// ─────────────────────────────────────────────
// history()
// ─────────────────────────────────────────────

describe('history()', () => {
  it('history grows with each set()', async () => {
    const s = createState(runtime, 0);
    await s.set(1);
    await s.set(2);
    expect(s.history()).toEqual([0, 1, 2]);
  });

  it('history returns a copy (mutating it does not affect state)', async () => {
    const s = createState(runtime, 'a');
    await s.set('b');
    const hist = s.history();
    hist.push('c');
    expect(s.history()).toEqual(['a', 'b']);
  });
});

// ─────────────────────────────────────────────
// undo() / redo()
// ─────────────────────────────────────────────

describe('undo()', () => {
  it('undo() restores the previous value', async () => {
    const s = createState(runtime, 0);
    await s.set(1);
    const restored = await s.undo();
    expect(restored).toBe(0);
    expect(s.get()).toBe(0);
  });

  it('undo() returns null when at initial state', async () => {
    const s = createState(runtime, 0);
    const result = await s.undo();
    expect(result).toBeNull();
  });

  it('undo() notifies subscribers', async () => {
    const s = createState(runtime, 0);
    const vals: number[] = [];
    s.subscribe((v) => vals.push(v));
    await s.set(5);
    await s.undo();
    expect(vals).toEqual([5, 0]);
  });

  it('multiple undos walk back through history', async () => {
    const s = createState(runtime, 'a');
    await s.set('b');
    await s.set('c');
    await s.undo();
    expect(s.get()).toBe('b');
    await s.undo();
    expect(s.get()).toBe('a');
  });
});

describe('redo()', () => {
  it('redo() after undo restores the next value', async () => {
    const s = createState(runtime, 0);
    await s.set(1);
    await s.undo();
    const result = await s.redo();
    expect(result).toBe(1);
    expect(s.get()).toBe(1);
  });

  it('redo() returns null when nothing to redo', async () => {
    const s = createState(runtime, 0);
    await s.set(1);
    const result = await s.redo();
    expect(result).toBeNull();
  });

  it('new set() after undo clears redo history', async () => {
    const s = createState(runtime, 0);
    await s.set(1);
    await s.set(2);
    await s.undo();
    await s.set(99); // branch: clears redo
    const result = await s.redo();
    expect(result).toBeNull();
    expect(s.get()).toBe(99);
  });

  it('redo notifies subscribers', async () => {
    const s = createState(runtime, 0);
    const vals: number[] = [];
    s.subscribe((v) => vals.push(v));
    await s.set(5);
    await s.undo();
    await s.redo();
    expect(vals).toEqual([5, 0, 5]);
  });
});
