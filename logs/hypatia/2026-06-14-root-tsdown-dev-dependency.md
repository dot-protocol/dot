# Hypatia Receipt: Root Tsdown Dev Dependency

Date: 2026-06-14
Branch: vps-hypatia

## Claim

Fix one narrow root validation blocker: TypeScript lint could not resolve
`tsdown` from package `tsdown.config.ts` files even though several workspaces
use `tsdown` as their build command.

## Changes

- Added `tsdown` as a root dev dependency with `pnpm add -D tsdown -w`.
- Updated `pnpm-lock.yaml` through the package manager.

## Validation

- `pnpm lint` passed.
- `pnpm test` still fails on pre-existing/non-slice blockers:
  - Missing generated WASM artifacts under `packages/wasm/pkg` cause the
    browser WASM loader and single-file WASM tests to fail.
  - `packages/core/src/__tests__/core.test.ts` has a 1MB observe edge case
    that exceeded the default 5s test timeout on this VPS run.

## Boundaries

No deploy, push, public posting, account operations, stream/key handling,
secrets, external audit files, destructive git commands, or unrelated edits.
