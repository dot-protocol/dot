# Hypatia Receipt: Package Pack Dry-Run Validation

Date: 2026-06-15T03:14:18Z
Branch: vps-hypatia

## Claim

Validate package publication metadata with dry-run packaging only. Do not publish, do not commit generated artifacts, and record the completed repo-only slice as a local receipt.

## Context

- Git worktree was valid and clean at startup.
- Local Dotpost was reachable; Hypatia posted a claim before validation.
- Authenticated Oracle HTTP was reachable.
- No local `tasks/` or `projects/` ledgers are present in this checkout.
- Newest Rocky direction confirms this checkout is the canonical agent git tree and `vps-hypatia` is the working branch.

## Validation

- `pnpm install --offline --frozen-lockfile`
  - Passed across all 34 workspace projects.
- `pnpm -r --if-present exec npm pack --dry-run --json`
  - Failed before validation because this `pnpm exec` does not support `--if-present`.
  - No file changes resulted.
- Package dry-run enumeration:
  - Ran `npm pack --dry-run --json` in each package directory with a package manifest.
  - Passed for 33 package manifests.
  - Summary: `packages=33 dryRunPassed=33 failures=0`.

## Package Dry-Run Summary

- `packages/arena`: `@dotprotocol/arena@0.3.0`, 11 files.
- `packages/bridge`: `@dot-protocol/bridge@1.0.0-alpha.0`, 2 files.
- `packages/browser`: `@dot-protocol/browser@1.0.0-alpha.0`, 17 files.
- `packages/chain`: `@dot-protocol/chain@1.0.0`, 17 files.
- `packages/chat`: `@dot-protocol/chat@1.0.0-alpha.0`, 9 files.
- `packages/cli`: `@dot-protocol/cli@1.0.0`, 7 files.
- `packages/compiler`: `@dot-protocol/compiler@1.0.0-alpha.0`, 11 files.
- `packages/compression`: `@dotprotocol/compression@0.3.0`, 11 files.
- `packages/core`: `@dot-protocol/core@1.0.0`, 87 files.
- `packages/first-room`: `@dot-protocol/first-room@1.0.0-alpha.0`, 12 files.
- `packages/fs`: `@dot-protocol/fs@1.0.0-alpha.0`, 17 files.
- `packages/identity`: `@dotprotocol/identity@0.3.0`, 11 files.
- `packages/kin`: `@dot-protocol/kin@1.0.0-alpha.0`, 11 files.
- `packages/lang`: `@dot-protocol/lang@1.0.0`, 22 files.
- `packages/mark`: `@dot-protocol/mark@1.0.0-alpha.0`, 16 files.
- `packages/mcp`: `@dot-protocol/mcp@1.0.0-alpha.0`, 11 files.
- `packages/mesh`: `@dot-protocol/mesh@1.0.0`, 21 files.
- `packages/minds`: `@dot-protocol/minds@1.0.0-alpha.0`, 27 files.
- `packages/qr`: `@dotprotocol/qr@0.3.0`, 11 files.
- `packages/relay`: `@dotprotocol/relay@0.3.0`, 27 files.
- `packages/room`: `@dot-protocol/room@1.0.0-alpha.0`, 12 files.
- `packages/room-ai`: `@dot-protocol/room-ai@1.0.0-alpha.0`, 9 files.
- `packages/script`: `@dot-protocol/script@1.0.0-alpha.0`, 13 files.
- `packages/sdk`: `@dotprotocol/sdk@0.3.0`, 7 files.
- `packages/seal`: `@dot-protocol/seal@1.0.0-alpha.0`, 13 files.
- `packages/selfhost`: `@dot-protocol/selfhost@1.0.0-alpha.0`, 17 files.
- `packages/signal`: `@dot-protocol/signal@1.0.0-alpha.0`, 11 files.
- `packages/sync`: `@dot-protocol/sync@1.0.0-alpha.0`, 12 files.
- `packages/transport`: `@dot-protocol/transport@1.0.0-alpha.0`, 11 files.
- `packages/tree`: `@dot-protocol/tree@1.0.0-alpha.0`, 12 files.
- `packages/ui`: `@dot-protocol/ui@1.0.0-alpha.0`, 10 files.
- `packages/viewer`: `@dot-protocol/viewer@1.0.0-alpha.0`, 13 files.
- `packages/wrapper`: `@dotprotocol/wrapper@0.3.0`, 11 files.

## Boundaries

- No source files changed.
- No generated package artifacts were committed.
- No external audit files, deploys, public posting, account operations, stream/key handling, launch claims, destructive git commands, or secret values were touched.

## Next

Continue narrow repo-local validation or documentation hygiene, or take the next concrete room assignment. Rust execution validation remains blocked until `cargo` is available on PATH.
