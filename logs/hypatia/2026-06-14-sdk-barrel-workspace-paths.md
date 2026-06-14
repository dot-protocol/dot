# Hypatia Receipt: SDK Barrel Workspace Paths

Date: 2026-06-14
Branch: vps-hypatia

## Claim

Fix one narrow SDK TypeScript hygiene slice: remove the SDK barrel `VerifyResult`
wildcard export ambiguity and make root TypeScript resolution independent of
missing workspace symlinks.

## Changes

- Replaced the SDK barrel's broad core and chain wildcard exports with explicit
  exports.
- Kept core `VerifyResult` as the SDK `VerifyResult` and exposed chain's
  verifier result as `ChainVerifyResult`.
- Added explicit root TypeScript `paths` entries for workspace package names,
  including the mixed `@dot-protocol/*` and `@dotprotocol/*` packages.

## Validation

- `pnpm exec vitest run packages/sdk/src/tests/sdk.test.ts --reporter=default`
  passed: 1 file / 5 tests.
- `pnpm exec tsc --noEmit 2>&1 | rg 'packages/sdk/src/index.ts|packages/sdk/src/tests/sdk.test.ts|TS2308|serializeBatchV2|deserializeBatchV2|Cannot find module .@dotprotocol'`
  produced no matches.
- `git diff --check` passed.
- Full `pnpm lint` still fails only on missing `tsdown` module/type declarations
  in package `tsdown.config.ts` files.

## Boundaries

No deploy, push, public posting, account operations, stream/key handling,
secrets, external audit files, destructive git commands, package-manager state
edits, or unrelated files.
