# Hypatia receipt: user manual package table drift

Time: 2026-06-14T19:21:19Z

Scope: narrow repo-only documentation consistency repair on `vps-hypatia`.

Changed:
- Refreshed the `USER_MANUAL.md` package table from the current workspace package manifests.
- Expanded the table from the stale 17-package subset to all 33 package manifests.
- Preserved current npm names exactly, including the packages currently scoped as `@dotprotocol/*`.

Validation:
- Package table consistency check passed: 33 manual rows, 33 package manifests, 0 missing, 0 extra.
- `git diff --check -- USER_MANUAL.md logs/hypatia/2026-06-14-user-manual-package-table-drift.md` passed.

Boundary:
- Documentation and receipt only.
- No production source edits, generated artifacts, external audit edits, deploy, public posting, account operations, stream/key handling, destructive git, or secrets.
- Pre-existing untracked `CANONICAL.md` left untouched.

Next:
- Continue narrow repo-local validation/schema/doc hygiene or take the next concrete room assignment.
