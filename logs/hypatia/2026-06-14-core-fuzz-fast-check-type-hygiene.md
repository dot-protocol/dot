# Hypatia Receipt: Core Fuzz Fast-Check Type Hygiene

Date: 2026-06-14

## Claim

Completed one narrow repo-only validation blocker repair in `packages/core/tests/fuzz.test.ts`.

## Changes

- Replaced constrained `fc.nat({ min, max })` generators with `fc.integer({ min, max })` for fast-check 4 type compatibility.
- Replaced two `expect(result.ok).toBe(false)` checks with explicit failure branches so TypeScript can narrow `tryDecode` failure results before reading `result.error`.

## Validation

- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit` passed.
- `pnpm vitest run packages/core/tests/fuzz.test.ts --reporter=default` passed: 45 tests.
- `git diff --check -- packages/core/tests/fuzz.test.ts logs/hypatia/2026-06-14-core-fuzz-fast-check-type-hygiene.md` passed.
- Added-line secret-shape scan on touched files found no matches.

## Blockers

- Repo-wide `pnpm lint` still fails on broad pre-existing TypeScript errors outside this slice, including arena export drift, missing `tsdown`, SDK package alias drift, QR legacy DOT mismatches, seal sodium type gaps, and other strictness issues.

## Boundary

No deploy, push, account operation, public posting, stream or key handling, external audit file edit, secret handling, or unrelated workspace edit was performed.
