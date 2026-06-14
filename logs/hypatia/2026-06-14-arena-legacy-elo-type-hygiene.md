# Hypatia Receipt: Arena Legacy Elo Type Hygiene

Date: 2026-06-14

## Claim

Cleared the first package-level TypeScript blocker in the active workspace: arena Elo exports and legacy DOT typing.

## Changes

- `packages/arena/src/elo.ts` now owns the small Elo scoring helpers it exports instead of importing removed chain helpers.
- `packages/arena/src/types.ts` types prediction and resolution wrappers around `LegacyDOT`, matching the v0.3.0 helpers used by the tests.
- `packages/arena/src/resolution.ts` uses the legacy wire encoder for prediction hashes and checks oracle keys with strict indexed access.
- `packages/core/src/index.ts` exports `legacyToBytes` for packages that need v0.3.0 wire bytes.
- Arena tests received strict indexed-access assertions.

## Validation

- `pnpm exec tsc -p packages/arena/tsconfig.json --noEmit --pretty false` passed.
- `pnpm vitest run packages/arena/src/tests/elo.test.ts packages/arena/src/tests/resolution.test.ts --reporter=default` passed: 2 files, 18 tests.
- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit --pretty false` passed.
- `git diff --check` passed.
- Added-line sensitive-shape scan found no matches.
- Package typecheck sweep now passes arena and stops at the next pre-existing blocker in bridge: tests are included outside `packages/bridge/src` while `rootDir` is set to `packages/bridge/src`.

## Boundaries

No deploy, push, account operations, public posting, stream/key handling, secret handling, external audit files, or unrelated edits.
