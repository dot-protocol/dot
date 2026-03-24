/**
 * executor.test.ts — Tests that DOT programs execute and produce real DOTs.
 *
 * 20+ tests verifying that executeDotProgram() produces signed, verifiable DOTs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeDotProgram } from '../src/executor.js';
import { createRuntime } from '@dot-protocol/script';
import { verify } from '@dot-protocol/core';
import type { DotRuntime } from '@dot-protocol/script';

// ---------------------------------------------------------------------------
// Shared runtime (reused across tests for speed)
// ---------------------------------------------------------------------------

let sharedRuntime: DotRuntime;

beforeEach(async () => {
  sharedRuntime = await createRuntime();
});

afterEach(async () => {
  await sharedRuntime.shutdown();
});

// ---------------------------------------------------------------------------
// hello.dot execution
// ---------------------------------------------------------------------------

describe('hello.dot execution', () => {
  const HELLO = `observe event: "hello world"\n`;

  it('executes without errors', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    expect(result.errors).toHaveLength(0);
  });

  it('produces exactly 1 DOT', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    expect(result.dots).toHaveLength(1);
  });

  it('produced DOT has event type', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    expect(result.dots[0]?.type).toBe('event');
  });

  it('produced DOT verifies successfully', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    const dot = result.dots[0]!;
    const verifyResult = await verify(dot);
    expect(verifyResult.valid).toBe(true);
  });

  it('produced DOT has a signature', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    const dot = result.dots[0]!;
    expect(dot.sign?.signature).toBeDefined();
  });

  it('produced DOT has a payload', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    const dot = result.dots[0]!;
    expect(dot.payload).toBeDefined();
  });

  it('execution is fast (< 500ms)', async () => {
    const result = await executeDotProgram(HELLO, sharedRuntime);
    expect(result.duration_ms).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// temperature.dot execution (gate evaluation)
// ---------------------------------------------------------------------------

describe('temperature.dot execution', () => {
  const TEMPERATURE = `observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
`;

  it('executes without errors', async () => {
    const result = await executeDotProgram(TEMPERATURE, sharedRuntime);
    expect(result.errors).toHaveLength(0);
  });

  it('produces 1 DOT (gate condition 82.3 > 80 = true)', async () => {
    const result = await executeDotProgram(TEMPERATURE, sharedRuntime);
    // 82.3 > 80 is true — gate passes — 1 DOT produced
    expect(result.dots).toHaveLength(1);
  });

  it('produced DOT has measure type', async () => {
    const result = await executeDotProgram(TEMPERATURE, sharedRuntime);
    expect(result.dots[0]?.type).toBe('measure');
  });

  it('produced DOT verifies', async () => {
    const result = await executeDotProgram(TEMPERATURE, sharedRuntime);
    const verifyResult = await verify(result.dots[0]!);
    expect(verifyResult.valid).toBe(true);
  });

  const BELOW_THRESHOLD = `observe measure: temperature at sensor_7 = 75.0
  .gate(temperature > 80)
  .pulse(alert: "overheating")
`;

  it('gate blocks observation when value <= threshold (75 > 80 = false)', async () => {
    const result = await executeDotProgram(BELOW_THRESHOLD, sharedRuntime);
    // 75 > 80 is false — gate blocks — 0 DOTs
    expect(result.dots).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// chain-demo.dot execution
// ---------------------------------------------------------------------------

describe('chain-demo.dot execution', () => {
  const CHAIN_DEMO = `observe event: "first observation"
observe event: "second observation"
  .chain(previous: first)
observe event: "third observation"
  .chain(previous: second)
`;

  it('executes without errors', async () => {
    const result = await executeDotProgram(CHAIN_DEMO, sharedRuntime);
    expect(result.errors).toHaveLength(0);
  });

  it('produces 3 DOTs', async () => {
    const result = await executeDotProgram(CHAIN_DEMO, sharedRuntime);
    expect(result.dots).toHaveLength(3);
  });

  it('all 3 DOTs have event type', async () => {
    const result = await executeDotProgram(CHAIN_DEMO, sharedRuntime);
    for (const dot of result.dots) {
      expect(dot.type).toBe('event');
    }
  });

  it('all 3 DOTs verify successfully', async () => {
    const result = await executeDotProgram(CHAIN_DEMO, sharedRuntime);
    for (const dot of result.dots) {
      const verifyResult = await verify(dot);
      expect(verifyResult.valid).toBe(true);
    }
  });

  it('all 3 DOTs have signatures (signed)', async () => {
    const result = await executeDotProgram(CHAIN_DEMO, sharedRuntime);
    for (const dot of result.dots) {
      expect(dot.sign?.signature).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// agent-demo.dot execution (one tick)
// ---------------------------------------------------------------------------

describe('agent-demo.dot execution', () => {
  const AGENT_DEMO = `agent health_monitor {
  every 5 seconds {
    observe measure: cpu_usage = 45.2
      .gate(cpu_usage > 90)
      .pulse(alert: "high CPU")
  }
}
`;

  it('executes without errors', async () => {
    const result = await executeDotProgram(AGENT_DEMO, sharedRuntime);
    expect(result.errors).toHaveLength(0);
  });

  it('agent body executes (gate blocks: 45.2 > 90 = false)', async () => {
    const result = await executeDotProgram(AGENT_DEMO, sharedRuntime);
    // 45.2 > 90 is false — gate blocks — 0 DOTs from this observation
    expect(result.dots).toHaveLength(0);
  });

  const AGENT_HIGH_CPU = `agent health_monitor {
  every 5 seconds {
    observe measure: cpu_usage = 95.0
      .gate(cpu_usage > 90)
      .pulse(alert: "high CPU")
  }
}
`;

  it('agent produces DOT when cpu > 90', async () => {
    const result = await executeDotProgram(AGENT_HIGH_CPU, sharedRuntime);
    expect(result.dots).toHaveLength(1);
    expect(result.dots[0]?.type).toBe('measure');
  });
});

// ---------------------------------------------------------------------------
// types-demo.dot execution (all 5 types)
// ---------------------------------------------------------------------------

describe('types-demo.dot execution', () => {
  const TYPES_DEMO = `observe measure: temperature = 22.5
observe state: reactor_status = "online"
observe event: "system started"
observe claim: "sensor calibrated"
observe bond: sensor_7
`;

  it('executes without errors', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    expect(result.errors).toHaveLength(0);
  });

  it('produces 5 DOTs', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    expect(result.dots).toHaveLength(5);
  });

  it('all 5 DOTs verify successfully', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    for (const dot of result.dots) {
      const r = await verify(dot);
      expect(r.valid).toBe(true);
    }
  });

  it('first DOT has measure type', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    expect(result.dots[0]?.type).toBe('measure');
  });

  it('second DOT has state type', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    expect(result.dots[1]?.type).toBe('state');
  });

  it('third DOT has event type', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    expect(result.dots[2]?.type).toBe('event');
  });

  it('fourth DOT has claim type', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    expect(result.dots[3]?.type).toBe('claim');
  });

  it('all 5 DOTs have valid signatures', async () => {
    const result = await executeDotProgram(TYPES_DEMO, sharedRuntime);
    for (const dot of result.dots) {
      expect(dot.sign?.signature).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('executor error handling', () => {
  it('returns errors for invalid DOT source', async () => {
    const result = await executeDotProgram('@invalid source!', sharedRuntime);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.dots).toHaveLength(0);
  });

  it('returns empty dots array for empty source', async () => {
    const result = await executeDotProgram('', sharedRuntime);
    expect(result.dots).toHaveLength(0);
  });

  it('creates its own runtime when none provided', async () => {
    const result = await executeDotProgram('observe event: "standalone"\n');
    expect(result.errors).toHaveLength(0);
    expect(result.dots).toHaveLength(1);
    if (result.runtime) {
      await result.runtime.shutdown();
    }
  });
});
