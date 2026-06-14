# Hypatia Receipt: Source Export Map Types Order

Date: 2026-06-14T17:48:23Z
Branch: vps-hypatia

Slice: complete package export-condition ordering hygiene for source-export manifests.

Context:
- Git worktree was valid on `vps-hypatia`.
- Local Dotpost was available; Hypatia posted a claim before editing.
- A previous slice repaired dist-style package export maps and left source-only packages as remaining work because they did not trigger runtime warnings.
- Pre-existing untracked `CANONICAL.md` was left untouched.

Changed:
- Reordered conditional export keys so `types` appears before runtime `import` in 26 source-export package manifests:
  - `packages/bridge/package.json`
  - `packages/browser/package.json`
  - `packages/chain/package.json`
  - `packages/chat/package.json`
  - `packages/cli/package.json`
  - `packages/compiler/package.json`
  - `packages/core/package.json`
  - `packages/first-room/package.json`
  - `packages/fs/package.json`
  - `packages/kin/package.json`
  - `packages/lang/package.json`
  - `packages/mark/package.json`
  - `packages/mcp/package.json`
  - `packages/mesh/package.json`
  - `packages/minds/package.json`
  - `packages/room-ai/package.json`
  - `packages/room/package.json`
  - `packages/script/package.json`
  - `packages/seal/package.json`
  - `packages/selfhost/package.json`
  - `packages/signal/package.json`
  - `packages/sync/package.json`
  - `packages/transport/package.json`
  - `packages/tree/package.json`
  - `packages/ui/package.json`
  - `packages/viewer/package.json`

Validated:
- Manifest checker over 35 package manifests: 35 workspace packages found, zero missing `workspace:*` targets, zero export-condition ordering problems.
- `pnpm lint` passed.
- `pnpm -r --if-present test` passed across package scripts, with the existing browser WASM artifact suites skipped: 154 test files passed, 2 skipped; 4099 tests passed, 60 skipped.
- `pnpm -r --if-present build` passed across recursive workspace build scope.
- `git diff --check` passed.

Notes:
- An initial targeted pnpm command used `--filter` after the script name, which forwarded it to Vitest/tsc and failed as an invocation error. The corrected filter placement passed for the targeted legacy-scope packages before the full validation run.
- Rust validation was not rerun in this slice; prior blocker remains that `cargo` is not exposed on this shell.

Boundaries:
- Package metadata and receipt only.
- No production source edits.
- No generated build output committed.
- No public posting, deploy, account operation, stream/key handling, external audit file edit, destructive git command, or secret exposure.
