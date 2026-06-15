# Live npm provenance — `@dotprotocol/*` packages

This document records where the **live published** npm packages come from, so anyone
can reproduce them. Resolved 2026-05-29 (Room "Mark III" reproducibility gate).

## The two scopes

There are two npm scopes, one hyphen apart:

- **`@dotprotocol/*`** (NO hyphen) — the **live, published, in-use** packages on npm.
- **`@dot-protocol/*`** (hyphen) — the namespace used inside this repo's source and in
  the unpublished granular alpha packages, plus the raw-source core packages listed
  below.

The live published packages keep their published **names, versions, and APIs** unchanged.
This repo is the public, reproducible **source** for them.

In this checkout the 7 `dist`-shipped packages already keep their live no-hyphen
`@dotprotocol/*` package names. The 5 raw-source packages listed below use the
hyphenated `@dot-protocol/*` names locally and are mapped to the live no-hyphen scope
at publish/reproduction time.

## Source map (live `@dotprotocol/*` → source in this repo)

| Live npm package (v1.0.0) | How it ships | Source |
|---|---|---|
| `@dotprotocol/core`   | raw `src/index.ts` | `packages/core` (named `@dot-protocol/core` here; published under no-hyphen scope) |
| `@dotprotocol/chain`  | raw `src/`         | `packages/chain` |
| `@dotprotocol/mesh`   | raw `src/`         | `packages/mesh` |
| `@dotprotocol/cli`    | —                  | `packages/cli` |
| `@dotprotocol/lang`   | —                  | `packages/lang` |
| `@dotprotocol/compression` | tsdown `dist/` | `packages/compression` |
| `@dotprotocol/qr`     | tsdown `dist/`     | `packages/qr` |
| `@dotprotocol/wrapper`| tsdown `dist/`     | `packages/wrapper` |
| `@dotprotocol/arena`  | tsdown `dist/`     | `packages/arena` |
| `@dotprotocol/relay`  | tsdown `dist/`     | `packages/relay` |
| `@dotprotocol/identity`| tsdown `dist/`    | `packages/identity` |
| `@dotprotocol/sdk`    | tsdown `dist/`     | `packages/sdk` |

The 7 `dist`-shipped packages were originally cut at source version `0.3.0` and published
to npm at `1.0.0` (a version bump, no API change). Their `src/` is committed here.

## Build / reproduce

`core`, `chain`, `mesh`, `cli`, `lang` publish their `src/` directly (the package `main`
points at `src/index.ts`), so they are reproduced by `npm pack` of the package directory.

The 7 `dist`-shipped packages build with `tsdown`:

```bash
pnpm install
cd packages/<pkg> && pnpm exec tsdown   # emits dist/
npm pack                                  # produces the publishable tarball
```

Note: package manifests intentionally mix the two local scopes. The 7 `dist`-shipped
packages keep their live `@dotprotocol/*` names and use `workspace:*` dependencies for
repo-local development; references to local core/chain still use the hyphenated
`@dot-protocol/*` package names. Standalone reproduction of live packages must preserve
the published no-hyphen names while accounting for this local source mapping.

## Acceptance test results (2026-05-29)

`npm pack` of source vs the live npm tarball, per package:

- `core`, `chain`, `mesh`: **file lists IDENTICAL**, `src/` contents byte-identical.
  Only difference is the package.json `name` (`@dot-protocol/` here vs `@dotprotocol/`
  published) — the publish step renames the scope.
- `identity`, `qr`, `arena`, `sdk`: built `dist/` **export surface matches live exactly**
  (same exported symbols). `dist` filenames carry tsdown content-hash suffixes which vary
  with toolchain version, so they are functionally — not byte — identical.
