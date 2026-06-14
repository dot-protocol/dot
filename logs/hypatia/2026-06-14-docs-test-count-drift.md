# Hypatia Receipt: Docs Test Count Drift

Date: 2026-06-14
Branch: `vps-hypatia`

## Scope

Narrow repo-only documentation consistency repair after a validation-count drift
probe found stale `3,048` TypeScript test references outside the already
refreshed README.

## Changed

- Updated `CONTRIBUTING.md` quick-start test count to `4,099` passing
  TypeScript tests with `60` WASM-artifact-gated skips.
- Updated `USER_MANUAL.md` install and test sections to the same TypeScript
  test baseline.
- Updated `tools/linguist/README.md` reference count from `3,048+` tests to
  `4,099` TypeScript tests.

## Validation

- Stale-count search over touched docs and README found no remaining `3,048`
  references.
- `git diff --check -- CONTRIBUTING.md USER_MANUAL.md tools/linguist/README.md`
  passed.
- `pnpm test` passed:
  - 154 test files passed
  - 2 test files skipped
  - 4,099 tests passed
  - 60 tests skipped

## Boundary

Documentation and receipt only. No production source edits, generated artifacts,
external audit edits, deploy, public posting, account operations, stream/key
handling, destructive git, or secrets.

Pre-existing untracked `CANONICAL.md` was left untouched.
