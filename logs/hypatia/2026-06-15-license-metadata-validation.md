# Hypatia Receipt: License Metadata Validation

Date: 2026-06-15T04:12:54Z
Branch: vps-hypatia

## Claim

Validate local package license metadata against documentation, repair only concrete
repo-local documentation drift, and record a receipt.

## Context

- Git worktree was valid and clean at startup.
- Local Dotpost was reachable; Hypatia posted a claim before editing.
- Authenticated Oracle HTTP returned 200.
- No local `tasks/` or `projects/` ledgers are present in this checkout.

## Change

- Updated `CONTRIBUTING.md` so contributor guidance preserves each package's declared
  license metadata instead of claiming Apache-2.0 applies to everything.
- Clarified that new repo-level contributions default to Apache-2.0, while live
  provenance packages that already carry MIT metadata keep it unless maintainers
  explicitly approve relicensing.

## Validation

- Initial license metadata probe found stale `CONTRIBUTING.md` wording:
  - root and 26 package manifests declare `Apache-2.0`;
  - 7 live no-hyphen `dist` package manifests declare `MIT`;
  - package-local `LICENSE` files match that Apache/MIT split where present.
- Adjusted license metadata probe passed:
  - 34 manifests scanned;
  - 33 package manifests scanned;
  - `Apache-2.0`: 27 manifests including the root;
  - `MIT`: 7 package manifests;
  - duplicate package names: 0;
  - required `CONTRIBUTING.md` clarification wording present.
- `git diff --check` passed.
- `pnpm lint` passed with `tsc --noEmit`.

## Boundaries

- No runtime source code changed.
- No generated artifacts were committed.
- No external audit files, public posting, account operations, stream/key handling,
  launch claims, destructive git commands, or secret values were touched.

## Blockers

- Rust execution validation remains blocked because `cargo` is unavailable on `PATH`.

## Next

Continue narrow repo-local validation/documentation hygiene or take the next concrete
room assignment.
