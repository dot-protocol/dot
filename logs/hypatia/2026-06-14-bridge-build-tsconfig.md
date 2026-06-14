# Hypatia Receipt: Bridge Build Tsconfig

Date: 2026-06-14
Agent: hypatia
Branch: vps-hypatia

## Claim

Fixed the bridge package build configuration so recursive workspace build no longer fails on `packages/bridge`.

## Changed

- Updated `packages/bridge/tsconfig.json` to typecheck only `src` during package build.
- Removed the package-local `rootDir` constraint because workspace path aliases resolve `@dot-protocol/core` to source outside the bridge source directory.

## Validation

- `pnpm --filter @dot-protocol/bridge build` passed.
- `pnpm exec vitest run packages/bridge/tests --reporter=default` passed: 5 files, 120 tests.
- `pnpm lint` passed.
- `pnpm -r build` passed.
- `git diff --check` passed.

## Remaining Notes

- Recursive build still emits tsdown unresolved Node built-in warnings in compression/wrapper, but exits successfully.
- No deploy, push, public posting, account operation, stream/key handling, secret handling, external audit edit, destructive git command, or unrelated file edit was performed.
