/**
 * @dot-protocol/compiler — Multilingual DOT compiler.
 *
 * Three operations:
 *
 *   compile()        — Natural language (any) → StructuredContent (languageless)
 *   decompile()      — StructuredContent → Natural language (any target)
 *   verifyFidelity() — Score how faithfully a rendering represents StructuredContent
 *
 * Usage with LocalCompiler (no LLM):
 *   import { compile, decompile, verifyFidelity, LocalCompiler } from '@dot-protocol/compiler';
 *   const provider = new LocalCompiler();
 *   const result = await compile("The temperature is 82°F.", provider);
 *
 * Usage with a custom LLM provider:
 *   const provider: CompilerProvider = {
 *     generate: async (prompt, system) => callYourLLM(prompt, system),
 *   };
 */

// Core operations
export { compile } from './compile.js';
export type { CompileResult } from './compile.js';

export { decompile } from './decompile.js';
export type { DecompileResult } from './decompile.js';

export { verifyFidelity } from './verify.js';
export type { VerifyResult } from './verify.js';

// Local (no-LLM) implementation
export { LocalCompiler, detectLanguage, extractClaims, extractEntities } from './local-compiler.js';

// Type definitions
export type {
  StructuredContent,
  Claim,
  Entity,
  Relationship,
  Citation,
  Scope,
  FidelityIssue,
  CompilerProvider,
} from './types.js';
