# Hypatia Receipt: Node Platform Tsdown Config

Date: 2026-06-14T14:33:00Z
Branch: vps-hypatia

## Claim

Repair Node builtin resolution warnings in the compression and wrapper package
builds without changing their published ESM entry filenames.

## Changed

- `packages/compression/tsdown.config.ts` now builds with `platform: 'node'`
  and `fixedExtension: false`.
- `packages/wrapper/tsdown.config.ts` now builds with `platform: 'node'`
  and `fixedExtension: false`.

## Validation

```bash
pnpm --filter @dotprotocol/compression build
pnpm --filter @dotprotocol/wrapper build
pnpm -r build
pnpm lint
pnpm test
git diff --check
```

Results:

- Both touched package builds passed without unresolved `node:*` builtin warnings.
- ESM outputs remained `dist/index.js` and `dist/index.d.ts`, matching package
  metadata.
- `pnpm -r build` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 154 test files passed, 2 skipped; 4099 tests passed,
  60 skipped.
- `git diff --check` produced no output.
- Added-line private-shape scan on touched config files found no matches.

## Boundaries

No production source edits, no generated build output committed, no external
audit file edits, no public posting, no deploy, no account operation, no
stream/key handling, no destructive git command, and no secret exposure.
