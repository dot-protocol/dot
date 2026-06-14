# Hypatia Receipt: signal call-health type hygiene

Date: 2026-06-14
Branch: vps-hypatia

## Changed

- Added `quality-report` to `SignalDOTType`.
- Updated `reportQuality` to construct the quality envelope with its final kind instead of mutating the envelope through a record cast.
- Tightened signal session/signaling tests for `noUncheckedIndexedAccess` array reads.

## Validation

- `pnpm vitest run packages/signal/tests --reporter=default` passed: 4 files, 86 tests.
- `pnpm lint 2>&1 | rg 'packages/signal'` returned no matches.
- `git diff --check -- packages/signal/src/call-health.ts packages/signal/src/types.ts packages/signal/tests/session.test.ts packages/signal/tests/signaling.test.ts` passed.
- Added-line sensitive-shape scan found no matches.

## Notes

- Full root `pnpm lint` still has unrelated existing blockers outside `packages/signal`.
- Boundary: repo-only type/test hygiene. No deploy, push, account operation, public posting, stream/key handling, credentials, external audit files, or unrelated edits.
