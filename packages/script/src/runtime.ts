/**
 * runtime.ts — DOT runtime lifecycle.
 *
 * createRuntime() is the single entry point that boots a fully-wired
 * DOT environment: identity → chain → optional mesh.
 *
 * runtime.observe() is the "easy API" — one call does observe → chain → sign
 * in the correct order, producing a fully-linked, signed DOT.
 */

import {
  observe as coreObserve,
  sign as coreSign,
  chain as coreChain,
  createIdentity,
} from '@dot-protocol/core';
import type { DOT, Identity, ObservationType } from '@dot-protocol/core';
import { createChain, append, tip as chainTip } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';

/** Configuration for creating a DotRuntime. */
export interface RuntimeConfig {
  /** Pre-existing identity. If omitted, one is auto-generated. */
  identity?: Identity;
  /** Path for persistent storage (currently informational; MemoryStorage used). */
  storagePath?: string;
  /** Whether to connect to a mesh network. Defaults to false. */
  meshEnabled?: boolean;
}

/** Options for runtime.observe(). */
export interface RuntimeObserveOptions {
  /** Observation type classification. */
  type?: ObservationType;
  /** If true, store payload as plaintext instead of FHE. */
  plaintext?: boolean;
}

/** The fully-booted DOT runtime handle. */
export interface DotRuntime {
  /** This runtime's Ed25519 identity. */
  readonly identity: Identity;

  /**
   * The "easy API": observe a payload, chain it, and sign it.
   *
   * Correct order: observe → chain (link to previous) → sign.
   * Returns a fully-formed, signed, causal DOT.
   *
   * @param payload - Value to observe (string, object, Uint8Array, or undefined)
   * @param opts    - Optional type and plaintext flag
   */
  observe(payload?: unknown, opts?: RuntimeObserveOptions): Promise<DOT>;

  /** The runtime's internal identity chain. */
  readonly chain: Chain;

  /** Mesh node (only present when meshEnabled: true). */
  readonly mesh?: unknown;

  /** Returns a health-measure DOT describing runtime state. */
  health(): DOT;

  /** Shuts down the runtime, stopping any background tasks. */
  shutdown(): Promise<void>;
}

/** Internal mutable runtime state. */
interface RuntimeState {
  identity: Identity;
  chain: Chain;
  mesh?: unknown;
  startTime: number;
  dotsCreated: number;
  isShutdown: boolean;
}

/**
 * Creates and boots a DOT runtime.
 *
 * Boot sequence:
 * 1. Generate or use provided identity
 * 2. Create an identity chain
 * 3. Optionally connect mesh
 *
 * @param config - Optional runtime configuration
 * @returns A booted DotRuntime
 *
 * @example
 * const rt = await createRuntime();
 * const dot = await rt.observe('hello world', { type: 'event' });
 * await rt.shutdown();
 */
export async function createRuntime(config?: RuntimeConfig): Promise<DotRuntime> {
  // 1. Identity: use provided or generate a new one
  const identity: Identity = config?.identity ?? (await createIdentity());

  // 2. Create the runtime's causal chain (in-memory by default)
  let chain = createChain();

  // 3. Emit a genesis DOT to anchor the identity chain
  const genesisUnsigned = coreObserve(
    { type: 'runtime_boot', publicKey: Buffer.from(identity.publicKey).toString('hex') },
    { type: 'event', plaintext: true },
  );
  const genesisChained = coreChain(genesisUnsigned as DOT);
  const genesisSigned = await coreSign(genesisChained, identity.secretKey);
  chain = append(chain, genesisSigned);

  const state: RuntimeState = {
    identity,
    chain,
    startTime: Date.now(),
    dotsCreated: 1, // genesis
    isShutdown: false,
  };

  const runtime: DotRuntime = {
    get identity() {
      return state.identity;
    },

    get chain() {
      return state.chain;
    },

    get mesh() {
      return state.mesh;
    },

    async observe(payload?: unknown, opts?: RuntimeObserveOptions): Promise<DOT> {
      if (state.isShutdown) {
        throw new Error('Runtime has been shut down');
      }

      // Step 1: observe (create unsigned DOT)
      const unsigned = coreObserve(payload, {
        type: opts?.type,
        plaintext: opts?.plaintext,
      });

      // Step 2: chain (link to previous tip in the runtime chain)
      const tipDot = getTipDot(state.chain);
      const chained = coreChain(unsigned as DOT, tipDot ?? undefined);

      // Step 3: sign
      const signed = await coreSign(chained, state.identity.secretKey);

      // Append to chain
      state.chain = append(state.chain, signed);
      state.dotsCreated++;

      return signed;
    },

    health(): DOT {
      const uptime = Date.now() - state.startTime;
      const chainsActive = 1;
      const memUsage = process.memoryUsage?.()?.heapUsed ?? 0;

      return coreObserve(
        {
          uptime_ms: uptime,
          dots_created: state.dotsCreated,
          chains_active: chainsActive,
          identity_chain_depth: state.chain.appendCount,
          memory_heap_used: memUsage,
          is_shutdown: state.isShutdown,
        },
        { type: 'measure', plaintext: true },
      ) as DOT;
    },

    async shutdown(): Promise<void> {
      state.isShutdown = true;
    },
  };

  return runtime;
}

/**
 * Retrieve the current tip DOT from a chain's storage.
 * Returns null if the chain is empty.
 */
function getTipDot(chain: Chain): DOT | null {
  return chainTip(chain);
}
