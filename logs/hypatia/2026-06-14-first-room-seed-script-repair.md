# Hypatia Receipt: first-room seed script repair

Time: 2026-06-14T20:04:11Z

## Claim

Repair one narrow repo-local first-room package hygiene issue after confirming `/opt/kin` is the canonical git worktree and Dotpost/Oracle are reachable.

## Changed

- `packages/first-room/package.json` now points `seed` at the existing `src/generate-html.ts` generator instead of missing `src/seed-runner.ts`.
- `packages/first-room/package.json` now includes the package-scoped `ts-node` dev dependency that the seed command already assumed.
- `pnpm-lock.yaml` records the new package-scoped dev dependency.
- `README.md` no longer tells users to open a nonexistent checked-in `packages/first-room/index.html`; it points to the generated `the-first-room.html` output.

## Validation

- `pnpm --filter @dot-protocol/first-room test` passed: 4 files, 100 tests.
- `HOME=$(mktemp -d) pnpm --filter @dot-protocol/first-room seed` passed and wrote `Downloads/the-first-room.html` under the temporary home.
- `pnpm lint` passed.
- `pnpm test` passed: 154 files passed, 2 skipped; 4,099 tests passed, 60 skipped.
- `pnpm build` passed across 33 of 34 workspace projects.
- `git diff --check -- README.md packages/first-room/package.json pnpm-lock.yaml` passed.

## Boundaries

No production behavior rewrite, generated HTML committed, external audit edits, deploy, public posting, account operations, stream/key handling, destructive git, or secrets. Pre-existing untracked `CANONICAL.md` left untouched.

## Next

Commit the touched files to `vps-hypatia` and send the room receipt.
