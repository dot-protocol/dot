/**
 * reactive.test.ts — DotStream tests.
 * Target: 20+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from '../src/runtime.js';
import { createStream } from '../src/reactive.js';
import type { DotRuntime } from '../src/runtime.js';
import type { DotStream } from '../src/reactive.js';

let runtime: DotRuntime;

beforeEach(async () => {
  runtime = await createRuntime();
});

// ─────────────────────────────────────────────
// createStream — basic
// ─────────────────────────────────────────────

describe('createStream — basic', () => {
  it('creates a stream with count 0', () => {
    const stream = createStream(runtime);
    expect(stream.count()).toBe(0);
  });

  it('latest() is null before any emission', () => {
    const stream = createStream(runtime);
    expect(stream.latest()).toBeNull();
  });
});

// ─────────────────────────────────────────────
// emit()
// ─────────────────────────────────────────────

describe('emit()', () => {
  it('emit() returns a DOT', async () => {
    const stream = createStream(runtime);
    const dot = await stream.emit('hello');
    expect(dot).toBeDefined();
    expect(dot.sign?.signature).toBeDefined();
  });

  it('emit() increments count', async () => {
    const stream = createStream(runtime);
    await stream.emit('a');
    expect(stream.count()).toBe(1);
    await stream.emit('b');
    expect(stream.count()).toBe(2);
  });

  it('emit() updates latest()', async () => {
    const stream = createStream(runtime);
    const dot = await stream.emit('payload');
    expect(stream.latest()).toBe(dot);
  });

  it('emit() with type sets the DOT type', async () => {
    const stream = createStream(runtime);
    const dot = await stream.emit('sensor reading', 'measure');
    expect(dot.type).toBe('measure');
  });

  it('emit() with event type', async () => {
    const stream = createStream(runtime);
    const dot = await stream.emit('click', 'event');
    expect(dot.type).toBe('event');
  });

  it('each emit produces a chained DOT', async () => {
    const stream = createStream(runtime);
    const dot1 = await stream.emit('first');
    const dot2 = await stream.emit('second');
    expect((dot2.chain?.depth ?? 0)).toBeGreaterThan((dot1.chain?.depth ?? 0));
  });

  it('emit() with no payload creates a DOT', async () => {
    const stream = createStream(runtime);
    const dot = await stream.emit(undefined);
    expect(dot).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// on()
// ─────────────────────────────────────────────

describe('on()', () => {
  it('on() handler fires on emit', async () => {
    const stream = createStream(runtime);
    const received: unknown[] = [];
    stream.on((dot) => received.push(dot));
    await stream.emit('test');
    expect(received.length).toBe(1);
  });

  it('on() receives the emitted DOT', async () => {
    const stream = createStream(runtime);
    let received = null as unknown;
    stream.on((dot) => { received = dot; });
    const emitted = await stream.emit('hello');
    expect(received).toBe(emitted);
  });

  it('unsubscribe stops the handler from firing', async () => {
    const stream = createStream(runtime);
    const received: unknown[] = [];
    const unsub = stream.on((dot) => received.push(dot));
    await stream.emit('one');
    unsub();
    await stream.emit('two');
    expect(received.length).toBe(1);
  });
});

// ─────────────────────────────────────────────
// filter()
// ─────────────────────────────────────────────

describe('filter()', () => {
  it('filter() returns a new stream', () => {
    const stream = createStream(runtime);
    const filtered = stream.filter(() => true);
    expect(filtered).not.toBe(stream);
  });

  it('filter() passes matching DOTs', async () => {
    const stream = createStream(runtime);
    const measures: unknown[] = [];
    stream.filter((d) => d.type === 'measure').on((d) => measures.push(d));

    await stream.emit('m', 'measure');
    await stream.emit('e', 'event');
    await stream.emit('m2', 'measure');

    expect(measures.length).toBe(2);
  });

  it('filter() blocks non-matching DOTs', async () => {
    const stream = createStream(runtime);
    const events: unknown[] = [];
    stream.filter((d) => d.type === 'event').on((d) => events.push(d));

    await stream.emit('not an event', 'measure');
    expect(events.length).toBe(0);
  });

  it('filtered stream latest() tracks only passing DOTs', async () => {
    const stream = createStream(runtime);
    const filtered = stream.filter((d) => d.type === 'measure');
    await stream.emit('e', 'event');
    expect(filtered.latest()).toBeNull();
    const m = await stream.emit('m', 'measure');
    expect(filtered.latest()).toBe(m);
  });

  it('filtered stream count() only counts passing DOTs', async () => {
    const stream = createStream(runtime);
    const filtered = stream.filter((d) => d.type === 'event');
    await stream.emit('a', 'event');
    await stream.emit('b', 'measure');
    await stream.emit('c', 'event');
    expect(filtered.count()).toBe(2);
  });
});

// ─────────────────────────────────────────────
// map()
// ─────────────────────────────────────────────

describe('map()', () => {
  it('map() returns a new stream', () => {
    const stream = createStream(runtime);
    const mapped = stream.map((d) => d);
    expect(mapped).not.toBe(stream);
  });

  it('map() transforms each DOT', async () => {
    const stream = createStream(runtime);
    const results: string[] = [];
    stream
      .map((d) => ({ ...d, type: 'state' as const }))
      .on((d) => results.push(d.type ?? ''));

    await stream.emit('data');
    expect(results).toEqual(['state']);
  });

  it('mapped stream count() tracks transformed DOTs', async () => {
    const stream = createStream(runtime);
    const mapped = stream.map((d) => d);
    await stream.emit('a');
    await stream.emit('b');
    expect(mapped.count()).toBe(2);
  });
});

// ─────────────────────────────────────────────
// Composable filter + map
// ─────────────────────────────────────────────

describe('composable filter + map', () => {
  it('filter().map() composes correctly', async () => {
    const stream = createStream(runtime);
    const results: string[] = [];

    stream
      .filter((d) => d.type === 'measure')
      .map((d) => ({ ...d, type: 'state' as const }))
      .on((d) => results.push(d.type ?? ''));

    await stream.emit('m', 'measure');
    await stream.emit('e', 'event');
    await stream.emit('m2', 'measure');

    expect(results).toEqual(['state', 'state']);
  });

  it('StreamOpts defaultType used when no type given', async () => {
    const stream = createStream(runtime, { defaultType: 'claim' });
    const dot = await stream.emit('default type test');
    expect(dot.type).toBe('claim');
  });
});
