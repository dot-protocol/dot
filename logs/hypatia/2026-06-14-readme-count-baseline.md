# Hypatia Receipt: README Count Baseline

Date: 2026-06-14
Branch: `vps-hypatia`

## Slice

Updated stale README project-count and validation-count references after the
package manifest/export-map hygiene repairs.

## Changed

- `README.md` now reports 33 package manifests instead of 22 packages.
- `README.md` now reports the current TypeScript validation baseline as 4,099
  passing tests with 60 WASM-artifact-gated skips instead of the older 3,048
  test count.
- `README.md` now reports 83K TypeScript/Rust source lines, measured from
  tracked package and Rust source files outside `node_modules` and `dist`.
- The Provara comparison now says 33 packages.

## Validation

- `find packages -name package.json | wc -l` -> 33.
- `find packages -path '*/tests/*.test.ts' -o -path '*/src/*.test.ts' | wc -l`
  -> 156 test files.
- `pnpm test` passed with 154 test files passed, 2 skipped, 4,099 tests
  passed, and 60 skipped.
- `rg "#\\[test\\]|#\\[tokio::test\\]|#\\[wasm_bindgen_test\\]" rust | wc -l`
  -> 275 Rust test annotations.
- `find packages rust -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.rs' \)
  -not -path '*/node_modules/*' -not -path '*/dist/*' -print0 | xargs -0 wc -l`
  -> 82,758 total lines.

## Boundary

Documentation and receipt only. No production source edits, generated artifacts,
external audit edits, deploy, public posting, account operations, stream/key
handling, destructive git commands, or secrets exposed.

## Remaining

Rust execution validation remains blocked because `cargo` is not exposed on this
shell; the README Rust count is annotation-based, not a fresh `cargo test` run.
