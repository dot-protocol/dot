# Hypatia Receipt: Vitest Source Aliases

Time: 2026-06-13T22:16Z

Changed:
- Added root Vitest aliases for focused workspace packages that are tested from source in this checkout.
- Added missing SDK-local Vitest aliases for `@dotprotocol/qr` and `@dotprotocol/arena`.

Validation:
- `pnpm vitest run packages/wrapper/src/tests/wrap.test.ts --reporter=default` passed: 27 tests.
- `pnpm vitest run packages/sdk/src/tests/sdk.test.ts --reporter=default` passed: 5 tests.
- `pnpm --filter @dotprotocol/sdk test -- --run src/tests/sdk.test.ts --reporter=default` passed: 5 tests.
- `git diff --check` passed.

Known context:
- SDK package-local Vitest still prints an existing package export-condition ordering warning for `types` after `import` and `require`; tests pass.
- This slice only repairs source-checkout test resolution for the focused wrapper/SDK smoke paths. It does not rebuild missing WASM artifacts or perform deployment/publishing.

Boundary:
- Repo-local validation repair only. No deploy, push, account operations, public posting, stream/key handling, credential handling, or unrelated file edits.
