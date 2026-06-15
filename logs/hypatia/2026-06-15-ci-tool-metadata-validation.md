# Hypatia Receipt: CI and Tool Metadata Validation

Timestamp: 2026-06-15T02:20:16Z

Scope:
- Checked the GitHub Actions CI workflow against root package scripts and local workspace metadata.
- Checked the VS Code DOT extension VSIX metadata and packaged files against checked-in tool sources.
- Checked offline frozen pnpm install viability against the current lockfile.

Validation:
- `node` workflow/package metadata probe passed:
  - CI `pnpm test` and `pnpm lint` commands map to root scripts.
  - 33 package manifests under `packages/` have matching `pnpm-lock.yaml` importers.
  - CI still pins Node 22, pnpm 10, checkout v4, stable Rust toolchain, and `cargo test --lib -- --test-threads=1`.
- VSIX archive probe passed:
  - Packaged `name`, `displayName`, `description`, `version`, `publisher`, and `license` match `tools/vscode-dot/package.json`.
  - Packaged `readme.md`, `language-configuration.json`, and `syntaxes/dot.tmLanguage.json` match checked-in tool sources byte-for-byte.
- `pnpm install --offline --frozen-lockfile` passed across all 34 workspace projects with no dependency changes.

Blockers / Notes:
- `actionlint` is not installed locally, so workflow validation was structural rather than full GitHub Actions semantic lint.
- Rust execution validation remains blocked on this VPS because `cargo` is unavailable on PATH.
- Browser real-WASM validation remains gated on generated WASM artifacts.

Boundaries:
- No production source edits.
- No generated artifact commits.
- No external audit files, deploys, public posting, account operations, stream/key handling, launch claims, destructive git commands, or secret exposure.
