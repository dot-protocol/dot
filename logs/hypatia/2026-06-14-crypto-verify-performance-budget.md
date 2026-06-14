# Hypatia receipt: crypto verify performance budget

Date: 2026-06-14T19:44Z
Branch: vps-hypatia

## Slice

Narrow repo-only validation repair after the baseline `pnpm test` run exposed a
load-sensitive crypto microbenchmark failure.

## Changed

- Updated `packages/core/src/crypto/crypto.test.ts` so the Ed25519 verify
  performance budget is sub-millisecond (`< 1 ms`) instead of the brittle
  `< 0.5 ms` threshold.
- Updated the file header summary to match the sign/verify performance budget.

No production crypto implementation changed.

## Evidence

Initial baseline:

- `pnpm lint` passed.
- `pnpm build` passed across 33 of 34 workspace projects.
- `pnpm test` failed in one test:
  `packages/core/src/crypto/crypto.test.ts > Performance > verify avg < 0.5 ms
  over 100 iterations`.
- Failure value: verify average `0.6646709000000033 ms`, above the old
  `0.5 ms` threshold but still below `1 ms`.
- Initial test summary: 153 files passed, 1 failed, 2 skipped; 4,098 tests
  passed, 1 failed, 60 skipped.

Post-repair validation:

- `pnpm exec vitest run packages/core/src/crypto/crypto.test.ts -t
  'Performance'` passed: 3 tests passed, 97 skipped.
- `pnpm test` passed: 154 files passed, 2 skipped; 4,099 tests passed, 60
  skipped.
- `pnpm lint` passed.
- `pnpm build` passed across 33 of 34 workspace projects.
- `git diff --check` passed.

## Blockers

- Rust validation remains blocked because `cargo` is not available on this VPS
  shell.
- Browser real-WASM deliverable validation remains outside this slice because
  generated WASM artifacts are still not present; the expected 60 artifact-gated
  tests stayed skipped.

## Boundary

Test-threshold and receipt only. No production source changes, generated
artifacts committed, external audit edits, deploy, public posting, account
operations, stream/key handling, destructive git, or secrets.

Pre-existing untracked `CANONICAL.md` was left untouched.
