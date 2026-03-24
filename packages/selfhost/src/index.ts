/**
 * @dot-protocol/selfhost — DOT Self-Hosting Layer
 *
 * R854 self-hosting milestone: DOT programs (.dot files) that, when compiled
 * to TypeScript by the lang package, produce working DOT protocol operations.
 * This proves DOT can express itself.
 *
 * Usage:
 *   import { compileDotFile, executeDotProgram, validateProgram, selfHostingScore } from '@dot-protocol/selfhost';
 *
 *   // Compile DOT source to TypeScript
 *   const ts = compileDotFile('observe event: "hello world"');
 *
 *   // Execute DOT program and get real DOTs
 *   const result = await executeDotProgram('observe event: "hello world"');
 *   console.log(result.dots[0]); // signed DOT
 *
 *   // Validate self-hosting
 *   const score = selfHostingScore([source1, source2]);
 *   console.log(score.scorePercent); // 100
 */

// Compiler pipeline
export { compileDotFile, compileDotToRuntime, validateRoundtrip } from './compiler.js';
export type { RoundtripResult } from './compiler.js';

// Executor
export { executeDotProgram } from './executor.js';
export type { ExecutionResult } from './executor.js';

// Validator
export { validateProgram, selfHostingScore } from './validator.js';
export type { ValidationResult, SelfHostingScore } from './validator.js';
