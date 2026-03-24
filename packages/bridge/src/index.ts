/**
 * @dot-protocol/bridge — v0.3.0 → R854 migration bridge.
 *
 * Reads, verifies, and converts 153-byte v0.3.0 DOTs to R854-native DOTs.
 * Produces a signed Bridge DOT attesting to the generation boundary.
 */

export {
  readLegacyDOT,
  readLegacyDOTRaw,
  buildLegacySignedBytes,
  trimTrailingZeros,
  isGenesisChainHash,
  LEGACY_DOT_SIZE,
  LEGACY_TYPE_PUBLIC,
  LEGACY_TYPE_CIRCLE,
  LEGACY_TYPE_PRIVATE,
  LEGACY_TYPE_EPHEMERAL,
} from './reader.js';
export type { LegacyDOT, LegacyVisibilityType } from './reader.js';

export { verifyLegacy, verifyLegacyChain, hashLegacyDOT } from './verify-legacy.js';
export type { ChainVerifyResult } from './verify-legacy.js';

export {
  convertDOT,
  convertChain,
  encodeLegacyChainRef,
  isLegacyChainRef,
  extractLegacyHash,
  LEGACY_HASH_PREFIX,
} from './converter.js';

export { createBridgeDOT } from './bridge-dot.js';
export type { BridgePayload, ChainSideDescriptor } from './bridge-dot.js';

export { batchConvert } from './batch.js';
export type { BatchConvertOptions, BatchConvertResult } from './batch.js';
