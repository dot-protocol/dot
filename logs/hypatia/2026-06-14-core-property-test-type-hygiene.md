# Hypatia Receipt: Core Property Test Type Hygiene

Date: 2026-06-14

## Claim

Narrow repo-only validation blocker repair in `/opt/kin` on branch `vps-hypatia`.

## Changed

- `packages/core/tests/property.test.ts` now imports Vitest `expect`, matching its existing assertion usage.
- Replaced two `fc.nat({ min, max })` calls with `fc.integer({ min, max })` for fast-check 4 type compatibility while preserving the tested integer ranges.

## Validation

- `pnpm vitest run packages/core/tests/property.test.ts --reporter=default` passed: 95 tests.
- `pnpm lint 2>&1 | rg 'packages/core/tests/property\.test\.ts' || true` produced no output after the change.

## Blockers

- Full `pnpm lint` still fails on broad pre-existing TypeScript errors outside this slice, including package export drift, duplicate Node type versions, missing `tsdown`, and unrelated package test strictness errors.
- Direct single-file `tsc` remains noisy because the current workspace has duplicate `@types/node` versions and dependency resolution issues; it no longer reports the touched `property.test.ts` errors.

## Boundary

No deploy, push, account operation, public posting, stream/key handling, external audit files, secret handling, or unrelated edits.
