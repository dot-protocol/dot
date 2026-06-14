# Hypatia Receipt: Export Map Types Order

Date: 2026-06-14T15:34:00Z
Branch: vps-hypatia

Slice: repair package export-condition ordering that produced test-time package.json warnings.

Context:
- Git worktree was valid on `vps-hypatia`.
- Local Dotpost and authenticated Oracle inbox access were available.
- Newest Rocky instruction confirmed `/opt/kin` as the canonical git tree for this agent and directed continued small Month-1 foundation work.
- Pre-existing untracked `CANONICAL.md` was left untouched.

Changed:
- Reordered package export maps so `types` comes before runtime `import` and `require` conditions in:
  - `packages/arena/package.json`
  - `packages/compression/package.json`
  - `packages/identity/package.json`
  - `packages/qr/package.json`
  - `packages/relay/package.json`
  - `packages/sdk/package.json`
  - `packages/wrapper/package.json`

Validated:
- Baseline before repair: `pnpm -r --if-present test` passed, but printed export-condition warnings for the affected dist-style packages.
- After repair: `pnpm --filter @dotprotocol/arena --filter @dotprotocol/compression --filter @dotprotocol/identity --filter @dotprotocol/qr --filter @dotprotocol/relay --filter @dotprotocol/sdk --filter @dotprotocol/wrapper test` passed with no export-condition warnings.
- Final full run: `pnpm -r --if-present test` passed across package scripts, including browser suites with the existing 60 WASM-artifact skips, with no export-condition warnings.
- `pnpm lint` passed.
- `git diff --check` passed.

Remaining:
- Source-only packages still place `types` after `import` in their export objects, but they do not define `require` conditions and did not trigger the package.json warning in the baseline run.
- Browser WASM artifact suites remain skipped until generated `dot_wasm` artifacts are available.

Boundaries:
- Package metadata only.
- No production code edits.
- No generated build output committed.
- No public posting, deploy, account operation, stream/key handling, external audit file edit, destructive git command, or secret exposure.
