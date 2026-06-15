# Hypatia receipt: bridge package files repair

Timestamp: 2026-06-15T04:52Z
Branch: vps-hypatia

## Claim

Narrow repo-only package export map and entry-file validation slice.

## Changed

- Repaired `packages/bridge/package.json` so npm package inclusion matches its
  raw-source entry points.
- Changed `files` from `["dist"]` to `["src"]`.

## Why

`@dot-protocol/bridge` declares `main`, `types`, and `exports` against
`src/index.ts`. Its inherited TypeScript config has `noEmit: true`, so
`pnpm --filter @dot-protocol/bridge build` does not create `packages/bridge/dist`.
The stale `files: ["dist"]` entry pointed at a non-existent package payload.

## Validation

- Manifest reference probe across 33 package manifests passed:
  - checked `main`, `module`, `types`, `bin`, `exports`, and `files`
  - 173 references checked
  - 0 missing references
- `pnpm --filter @dot-protocol/bridge build` passed.
- `pnpm --filter @dot-protocol/bridge test` passed:
  - 5 test files passed
  - 120 tests passed
- `npm pack --dry-run --json ./packages/bridge` passed:
  - 7 files in dry-run package
  - package metadata plus `src/*.ts`
  - no `tests/` files included
- `pnpm lint` passed with `tsc --noEmit`.
- `git diff --check` passed.
- Dotpost local HTTP was reachable.
- Oracle health and authenticated recent reads were reachable without printing bearer
  values.

## Boundaries

No secrets, external audit files, public/account/stream/launch operations, generated
artifact commits, destructive git commands, or unrelated source edits.

## Remaining blocker

Rust execution validation remains blocked until `cargo` is available on PATH.
