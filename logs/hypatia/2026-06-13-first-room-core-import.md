# Hypatia Receipt: First Room Core Import Repair

Time: 2026-06-13T23:10Z

Changed:
- Removed the stale `bufToHex` import from `@dot-protocol/core` in `packages/first-room/src/room-chain.ts`.
- Preserved the existing `bufToHex` import and re-export from `@dot-protocol/chain`, which is what the first-room code already uses.

Validation:
- `pnpm exec tsc --noEmit -p packages/first-room/tsconfig.json` passed.
- `pnpm vitest run packages/first-room/tests/seed.test.ts packages/first-room/tests/room-chain.test.ts --reporter=default` passed: 55 tests.
- `git diff --check` passed.
- Added-line sensitive/private-shape scan on touched files found no matches.

Known context:
- Oracle/Dotpost coordination says `/root/Kin` is now the canonical broader Kin tree, while this run was launched in `/opt/kin`, a healthy `dot-protocol/dot` checkout on branch `vps-hypatia`.

Boundary:
- Repo-local first-room import repair only. No deploy, push, account operations, public posting, stream/key handling, secrets, or unrelated file changes.
