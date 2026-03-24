/**
 * meta.test.ts — The self-awareness layer.
 *
 * 10+ tests where the test suite itself creates DOTs recording test results.
 * Each test result becomes a signed DOT on a meta-chain.
 * "DOT tests DOT testing DOT" — three levels deep.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRuntime } from '@dot-protocol/script';
import { verify } from '@dot-protocol/core';
import { append, createChain, tip } from '@dot-protocol/chain';
import { executeDotProgram } from '../src/executor.js';
import { validateRoundtrip } from '../src/compiler.js';
import { selfHostingScore } from '../src/validator.js';
import type { DotRuntime } from '@dot-protocol/script';
import type { DOT } from '@dot-protocol/core';
import type { Chain } from '@dot-protocol/chain';

// ---------------------------------------------------------------------------
// Meta-chain: a chain of DOTs that record test results
// ---------------------------------------------------------------------------

let metaRuntime: DotRuntime;
let metaChain: Chain;
const metaDots: DOT[] = [];

beforeAll(async () => {
  metaRuntime = await createRuntime();
  metaChain = createChain();
});

afterAll(async () => {
  await metaRuntime.shutdown();
});

/** Record a test result as a DOT on the meta-chain. */
async function recordTestResult(
  testName: string,
  passed: boolean,
  detail?: string,
): Promise<DOT> {
  const dot = await metaRuntime.observe(
    {
      test: testName,
      passed,
      detail: detail ?? '',
      timestamp: Date.now(),
    },
    { type: 'claim', plaintext: true },
  );
  metaChain = append(metaChain, dot);
  metaDots.push(dot);
  return dot;
}

// ---------------------------------------------------------------------------
// Level 1: DOT programs execute correctly (tests produce DOTs)
// ---------------------------------------------------------------------------

describe('meta level 1 — DOT programs produce DOTs', () => {
  it('hello.dot execution produces a DOT that records itself', async () => {
    const result = await executeDotProgram('observe event: "hello world"\n');
    const passed = result.dots.length === 1 && result.errors.length === 0;

    const metaDot = await recordTestResult(
      'hello.dot execution produces 1 DOT',
      passed,
      `dots: ${result.dots.length}, errors: ${result.errors.length}`,
    );

    // The recording itself is verified
    const verifyResult = await verify(metaDot);
    expect(verifyResult.valid).toBe(true);
    expect(passed).toBe(true);

    if (result.runtime) await result.runtime.shutdown();
  });

  it('types-demo.dot execution produces 5 DOTs that record themselves', async () => {
    const src = `observe measure: temperature = 22.5
observe state: reactor_status = "online"
observe event: "system started"
observe claim: "sensor calibrated"
observe bond: sensor_7
`;
    const result = await executeDotProgram(src);
    const passed = result.dots.length === 5;

    const metaDot = await recordTestResult(
      'types-demo.dot produces 5 DOTs',
      passed,
      `dots: ${result.dots.length}`,
    );

    const verifyResult = await verify(metaDot);
    expect(verifyResult.valid).toBe(true);
    expect(passed).toBe(true);

    if (result.runtime) await result.runtime.shutdown();
  });
});

// ---------------------------------------------------------------------------
// Level 2: Validation results record themselves as DOTs
// ---------------------------------------------------------------------------

describe('meta level 2 — validation results become DOTs', () => {
  it('roundtrip validation result recorded as a signed claim DOT', async () => {
    const src = 'observe event: "self-aware"\n';
    const roundtrip = validateRoundtrip(src);

    const metaDot = await recordTestResult(
      'roundtrip validation for observe event',
      roundtrip.valid,
      `typescript generated: ${roundtrip.typescript ? 'yes' : 'no'}`,
    );

    // The meta DOT is a valid claim
    expect(metaDot.type).toBe('claim');
    const verifyResult = await verify(metaDot);
    expect(verifyResult.valid).toBe(true);
    expect(roundtrip.valid).toBe(true);
  });

  it('selfHostingScore result recorded as a measure DOT', async () => {
    const programs = [
      'observe event: "hello world"\n',
      'observe measure: temperature = 22.5\n',
      'observe claim: "sensor calibrated"\n',
    ];

    const score = selfHostingScore(programs, programs.length);

    const metaDot = await recordTestResult(
      'selfHostingScore across 3 programs',
      score.scorePercent === 100,
      `score: ${score.scorePercent}%, parsed: ${score.parsed}, compiled: ${score.compiled}`,
    );

    expect(metaDot.type).toBe('claim');
    const verifyResult = await verify(metaDot);
    expect(verifyResult.valid).toBe(true);
    expect(score.scorePercent).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Level 3: The meta-chain itself is verified (DOT tests DOT testing DOT)
// ---------------------------------------------------------------------------

describe('meta level 3 — the meta-chain verifies end-to-end', () => {
  it('meta-chain contains all recorded test result DOTs', () => {
    // At this point we should have accumulated meta DOTs
    expect(metaDots.length).toBeGreaterThan(0);
    expect(metaChain.appendCount).toBeGreaterThan(0);
  });

  it('all meta DOTs in the chain have signatures', () => {
    for (const dot of metaDots) {
      expect(dot.sign?.signature).toBeDefined();
    }
  });

  it('all meta DOTs verify as valid', async () => {
    for (const dot of metaDots) {
      const result = await verify(dot);
      expect(result.valid).toBe(true);
    }
  });

  it('meta-chain tip is the most recent meta DOT', () => {
    const chainTip = tip(metaChain);
    expect(chainTip).toBeDefined();
    // Tip is in our meta dots
    const tipInMetaDots = metaDots.some(
      d => d.sign?.signature?.toString() === chainTip?.sign?.signature?.toString()
    );
    expect(tipInMetaDots).toBe(true);
  });

  it('meta-chain depth grows with each recorded test', () => {
    expect(metaChain.appendCount).toBeGreaterThanOrEqual(3);
  });

  it('recording a final summary DOT completes the meta-chain', async () => {
    const finalDot = await recordTestResult(
      'meta-test-suite complete',
      true,
      `total meta DOTs: ${metaDots.length}, chain depth: ${metaChain.appendCount}`,
    );

    const verifyResult = await verify(finalDot);
    expect(verifyResult.valid).toBe(true);
    expect(finalDot.type).toBe('claim');
  });

  it('full meta-chain is internally consistent (all appended DOTs present)', () => {
    // chain.appendCount should equal number of appended DOTs
    expect(metaChain.appendCount).toBe(metaDots.length);
  });
});

// ---------------------------------------------------------------------------
// Level 0: DOT expressing itself about DOT
// ---------------------------------------------------------------------------

describe('meta level 0 — DOT program describing DOT', () => {
  it('a DOT program about the DOT protocol compiles successfully', () => {
    const aboutDot = `observe claim: "DOT is a self-describing observation protocol"
observe event: "self-hosting milestone achieved"
observe measure: programs_compiled = 7
`;
    const result = validateRoundtrip(aboutDot);
    expect(result.valid).toBe(true);
    expect(result.typescript).toContain('@dot-protocol/core');
  });

  it('executing a DOT program about DOT produces real DOTs', async () => {
    const aboutDot = `observe claim: "DOT tests DOT"
observe event: "three levels deep"
`;
    const result = await executeDotProgram(aboutDot);
    expect(result.dots).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    // These DOTs are valid
    for (const dot of result.dots) {
      const verifyResult = await verify(dot);
      expect(verifyResult.valid).toBe(true);
    }

    // Record THIS test's result as a DOT (the outermost level of recursion)
    const metaDot = await recordTestResult(
      'DOT program about DOT produces valid DOTs',
      true,
      'three levels: DOT tests DOT testing DOT',
    );
    expect(metaDot.type).toBe('claim');

    if (result.runtime) await result.runtime.shutdown();
  });
});
