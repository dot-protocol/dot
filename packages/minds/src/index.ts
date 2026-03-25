/**
 * @dot-protocol/minds — Provider-agnostic AI minds.
 *
 * A Mind has identity (Ed25519 keypair), knowledge (primary sources),
 * and the ability to observe and respond. The InferenceProvider interface
 * decouples each Mind from any specific AI backend.
 *
 * Included minds:
 * - Feynman: physics, education, curiosity (1918–1988)
 * - Rumi: poetry, spirituality, love (1207–1273)
 * - Shannon: information theory, mathematics (1916–2001)
 *
 * @example
 * import { createFeynman, createRumi, createShannon } from '@dot-protocol/minds';
 *
 * const feynman = await createFeynman();
 * const response = await feynman.respond("What is quantum mechanics?");
 * console.log(response.text);
 * console.log(response.citations);
 */

// Core types
export type {
  MindConfig,
  MindState,
  MindResponse,
  Citation,
  Source,
  SourceType,
  InferenceProvider,
  InferenceOptions,
} from './types.js';

// Mind class and factory
export { Mind, createMind } from './mind.js';

// LocalInference (no-API provider)
export { LocalInference, extractKeywords } from './local-inference.js';

// The three minds
export { createFeynman, FEYNMAN_CONFIG } from './feynman.js';
export { createRumi, RUMI_CONFIG } from './rumi.js';
export { createShannon, SHANNON_CONFIG } from './shannon.js';
