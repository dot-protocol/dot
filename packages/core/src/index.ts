/**
 * @dot-protocol/core — The DOT STCV kernel.
 *
 * observe / sign / verify / chain / hash / encode / trust / identity
 *
 * R854.1: ALL STCV bases optional. FHE by default. {} is a valid DOT.
 */

export { observe } from './observe.js';
export type { ObserveOptions } from './observe.js';

export { sign, buildSignedBytes } from './sign.js';

export { verify } from './verify.js';
export type { VerifyResult } from './verify.js';

export { chain, hash } from './chain.js';

export { toBytes, fromBytes } from './encode.js';

export { computeTrust } from './trust.js';

export { createIdentity } from './identity.js';
export type { Identity } from './identity.js';

export { computeLevel, DOTLevel } from './types.js';
export type {
  DOT,
  UnsignedDOT,
  ObservationType,
  PayloadMode,
  IdentityLevel,
} from './types.js';

export { type Result, type DOTError, ok, err, isOk, isErr, unwrap, unwrapOr } from './result.js';
export { safeVerify, safeSign, safeDecode, safeHash } from './safe.js';
