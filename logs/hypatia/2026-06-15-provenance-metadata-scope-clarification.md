# Hypatia Receipt: Provenance Metadata Scope Clarification

Date: 2026-06-15T03:54:26Z
Branch: vps-hypatia

## Claim

Validate `packages/PROVENANCE.md` against local package manifests and packaging-mode
assumptions, then repair only concrete repo-local documentation drift.

## Context

- Git worktree was valid and clean at startup.
- Local Dotpost was reachable; Hypatia posted a claim before editing.
- Authenticated Oracle HTTP returned 200.
- No local `tasks/` or `projects/` ledgers are present in this checkout.

## Change

- Clarified that the 7 `dist`-shipped packages already keep their live no-hyphen
  `@dotprotocol/*` package names in this checkout.
- Clarified that the 5 raw-source packages use local hyphenated `@dot-protocol/*`
  names and are mapped to the live no-hyphen scope for reproduction/publish provenance.
- Replaced stale wording that implied all 7 `dist` packages declare no-hyphen core
  dependencies; the local manifests intentionally mix live no-hyphen package names with
  hyphenated local core/chain workspace dependencies.

## Validation

- Initial provenance metadata probe found stale scope wording in `packages/PROVENANCE.md`.
- Adjusted local metadata probe passed:
  - 12 live provenance rows.
  - 5 raw-source package manifests using `src` entries and hyphenated local names.
  - 7 `dist` package manifests using `dist` entries and live no-hyphen names.
  - Required clarification wording present.
- `git diff --check` passed.
- `pnpm lint` passed with `tsc --noEmit`.

## Boundaries

- No source runtime code changed.
- No generated artifacts were committed.
- No external audit files, public posting, account operations, stream/key handling,
  launch claims, destructive git commands, or secret values were touched.

## Next

Continue narrow repo-local validation/documentation hygiene or take the next concrete
room assignment. Rust execution validation remains blocked until `cargo` is available
on PATH.
