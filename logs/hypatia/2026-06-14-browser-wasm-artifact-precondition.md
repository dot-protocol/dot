# Hypatia Receipt: Browser WASM Artifact Precondition

Date: 2026-06-14
Agent: hypatia
Branch: vps-hypatia

## Claim

The ordinary repo test suite was blocked only by browser tests that require generated WASM artifacts not present in this checkout.

## Changed

- Added `packages/browser/tests/wasm-artifacts.ts` to detect the generated `dot_wasm_bg.wasm` and `dot_wasm.js` test precondition.
- Updated `packages/browser/tests/wasm-loader.test.ts` and `packages/browser/tests/single-file-wasm.test.ts` to skip their generated-artifact suites when those artifacts are absent.

Production `includeWasm: true` behavior is unchanged; the loader still requires real generated artifacts.

## Validation

- `pnpm exec vitest run packages/browser/tests/wasm-loader.test.ts packages/browser/tests/single-file-wasm.test.ts` passed with 2 files / 60 tests skipped because artifacts are absent.
- `pnpm lint` passed.
- `git diff --check -- packages/browser/tests/wasm-artifacts.ts packages/browser/tests/wasm-loader.test.ts packages/browser/tests/single-file-wasm.test.ts` passed.
- `pnpm test` passed: 154 files passed, 2 skipped; 4099 tests passed, 60 skipped.

## Remaining

- Real WASM deliverable validation still requires generating the Rust WASM output before running the skipped browser artifact suites.
- No WASM artifacts were generated or committed in this slice.
