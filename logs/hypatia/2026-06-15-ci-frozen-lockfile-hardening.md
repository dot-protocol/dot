# Hypatia Receipt: CI Frozen Lockfile Hardening

Timestamp: 2026-06-15T05:26Z
Branch: vps-hypatia

## Scope

Narrow repo-only CI dependency hygiene slice.

## Changed

- Updated `.github/workflows/ci.yml` Node jobs to run `pnpm install --frozen-lockfile`.
- Removed the prior `--no-frozen-lockfile` install flag from both TypeScript test and lint jobs.

## Why

The repo has a checked-in `pnpm-lock.yaml`, and local frozen/offline install validation
passes across all workspace projects. CI should fail on lockfile drift instead of
allowing install-time lockfile mutation.

## Validation

- Structural workflow/package probe passed:
  - root `pnpm test` and `pnpm lint` commands still map to package scripts
  - Node 22 and pnpm 10 pins remain present
  - Rust command remains `cargo test --lib -- --test-threads=1`
  - 2 `--frozen-lockfile` installs and 0 `--no-frozen-lockfile` installs
- `pnpm install --offline --frozen-lockfile` passed across all 34 workspace projects.
- `pnpm lint` passed.
- `git diff --check` passed.

## Boundaries

No production source edits, dependency changes, generated artifact commits, external
audit files, public/account/stream/launch operations, destructive git commands, or
secret exposure.

## Remaining blocker

Rust execution validation remains blocked until `cargo` is available on `PATH`.
