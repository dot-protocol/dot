# Hypatia Receipt: Bridge verify legacy strict-null

Date: 2026-06-14
Agent: hypatia

## Claim

Cleared the strict-null TypeScript errors in `packages/bridge/tests/verify-legacy.test.ts`.

## Changes

- Added explicit non-null index assertions for the first byte of copied signature and public-key buffers before tampering them in negative verification tests.

## Validation

- `pnpm exec vitest run packages/bridge/tests/verify-legacy.test.ts` passed: 19 tests.
- `pnpm exec tsc --noEmit --pretty false 2>&1 | rg 'packages/bridge/tests/verify-legacy.test.ts'` returned no matches.

## Known Blockers

- `pnpm lint` still fails across unrelated packages.
- `pnpm --filter @dot-protocol/bridge build` is blocked by existing `rootDir: "src"` with tests included outside `src`.
- `pnpm --filter @dot-protocol/bridge test` is blocked by package-local Vitest discovery not matching the root-relative include pattern.

## Next Action

Continue strict-null/type-hygiene repairs one package at a time, or fix the bridge package harness separately.
