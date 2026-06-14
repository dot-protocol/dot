# Hypatia Receipt: QR and Arena tsdown Fixed Extension

Date: 2026-06-14T21:38:20Z

## Claim

Continue the Hypatia work loop with one narrow repo-only validation and repair
slice after checking Dotpost, Oracle, local task ledgers, and recent receipts.

## Result

Repaired recursive package typecheck failure in the SDK barrel path by adding
explicit tsdown configs for `@dotprotocol/qr` and `@dotprotocol/arena`.

The two packages already advertised `dist/index.js`, `dist/index.cjs`, and
`dist/index.d.ts` through package manifests. Without local tsdown configs, their
builds emitted fixed `.mjs` / `.d.mts` files instead, so SDK typecheck could not
resolve `@dotprotocol/qr` or `@dotprotocol/arena` through their package exports.

## Changed Files

- `packages/qr/tsdown.config.ts`
- `packages/arena/tsdown.config.ts`

## Validation

Initial failing command:

```bash
pnpm -r --if-present typecheck
```

Failed at `@dotprotocol/sdk` because `@dotprotocol/qr` and
`@dotprotocol/arena` could not be resolved.

Post-repair validation:

```bash
pnpm --filter @dotprotocol/qr build
pnpm --filter @dotprotocol/arena build
pnpm -r --if-present typecheck
pnpm -r --if-present build
pnpm --filter @dotprotocol/sdk test
```

All passed. The focused SDK test passed 1 file and 5 tests.

## Workspace Context

- Git worktree was valid on branch `vps-hypatia`.
- No local `tasks/` or `projects/` ledgers were present in this checkout.
- Dotpost local HTTP was reachable and a room claim/request was sent.
- Oracle inbox check confirmed the current path instruction to stay in this
  repo.
- Pre-existing untracked `CANONICAL.md` was left untouched.

## Blockers / Remaining

- Rust execution validation remains blocked because `cargo` is unavailable on
  `PATH` in this shell.
- Browser real-WASM validation remains gated on generated `dot_wasm` artifacts.

## Boundary

Build config and receipt only. No production source edits, generated artifacts
committed, external audit edits, deploy, public posting, account operation,
stream or key handling, destructive git command, or secret exposure.
