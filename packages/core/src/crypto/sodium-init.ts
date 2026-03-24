/**
 * @module sodium-init
 * Lazy singleton for libsodium-wrappers-sumo.
 *
 * libsodium ships its ESM wrapper without the WASM blob bundled, which
 * causes module-not-found errors in Vitest / Node ESM environments.
 * We import the CJS build explicitly via createRequire, which resolves
 * correctly in all environments.
 *
 * The singleton ensures `await sodium.ready` is executed at most once
 * across the lifetime of the process.
 */

import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

// Import the CJS build of libsodium-wrappers-sumo directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sodiumLib = _require('libsodium-wrappers-sumo') as {
  ready: Promise<void>;
  crypto_sign_keypair(): {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    keyType: string;
  };
  crypto_sign_detached(
    message: Uint8Array | string,
    secretKey: Uint8Array,
  ): Uint8Array;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: Uint8Array | string,
    publicKey: Uint8Array,
  ): boolean;
  crypto_sign_ed25519_sk_to_pk(secretKey: Uint8Array): Uint8Array;
  randombytes_buf(n: number): Uint8Array;
};

/** Typed libsodium handle after ready resolves. */
export type SodiumLib = typeof sodiumLib;

/** Cached instance after first init. */
let sodiumInstance: SodiumLib | null = null;

/** In-flight init promise — prevents double-initialisation. */
let initPromise: Promise<SodiumLib> | null = null;

/**
 * Return the initialised libsodium instance, loading it on first call.
 *
 * Subsequent calls return instantly from the in-memory cache.
 *
 * @returns Resolved libsodium-wrappers-sumo instance
 */
export async function getSodium(): Promise<SodiumLib> {
  if (sodiumInstance !== null) return sodiumInstance;

  if (initPromise === null) {
    initPromise = (async () => {
      await sodiumLib.ready;
      sodiumInstance = sodiumLib;
      return sodiumLib;
    })();
  }

  return initPromise;
}
