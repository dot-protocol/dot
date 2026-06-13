# Hypatia Receipt: Core Legacy Compatibility Exports

Time: 2026-06-13T21:58Z

Changed:
- Added `packages/core/src/legacy.ts` with fixed-width 153-byte DOT compatibility helpers for older QR, identity, arena, compression, wrapper, and SDK consumers.
- Exported legacy helpers from `packages/core/src/index.ts`: `createKeypair`, `createDOT`, `DotType`, `verifyDOT`, `checkChain`, pseudo-BLS helpers, and `batchPackBLS`.
- Updated `packages/core/src/encode.ts` so `toBytes()` writes legacy DOTs as 153-byte frames and `fromBytes()` can decode 153-byte frames at runtime without widening the public STCV return type.
- Added `packages/core/tests/legacy.test.ts` to guard legacy DOT encoding, verification, chaining, pseudo-BLS aggregate verification, and v1 BLS frame sizing.

Validation:
- `pnpm vitest run packages/core/tests/legacy.test.ts packages/compression/src/tests/batch-v2.test.ts packages/compression/src/tests/batch-v2-dict.test.ts packages/compression/src/tests/batch-v2-predict.test.ts --reporter=default` passed: 30 tests.
- `pnpm vitest run packages/core/src/__tests__/core.test.ts packages/core/tests/legacy.test.ts packages/core/tests/result.test.ts --reporter=default` passed: 245 tests.
- `pnpm vitest run packages/identity/src/tests/identity.test.ts packages/qr/src/tests/encode.test.ts packages/arena/src/tests/resolution.test.ts --reporter=default` passed: 28 tests.
- `git diff --check` passed.
- Added-line sensitive/private-shape scan over touched core files found no matches.

Known blockers:
- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit` remains blocked by pre-existing strict-null errors in `packages/core/src/crypto/crypto.test.ts` lines 233, 242, and 251.
- Wrapper and SDK smoke tests still cannot collect because `@dotprotocol/compression` resolves to missing `dist` package entries in this source checkout.
- Full `pnpm test` remains blocked by pre-existing missing WASM artifacts and package entry issues, though this slice removes the `createKeypair`/legacy core export failure class from focused packages.

Boundary:
- Repo-local core compatibility repair only. No deploy, push, account operations, public posting, stream/key handling, credential handling, or unrelated file edits.
