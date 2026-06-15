# Hypatia receipt: tooling artifact validation

Date: 2026-06-15
Branch: vps-hypatia
Claim: msg-1bcc63aa-562c-4ca7-b1cb-f9aee8fd69c8

## Scope

Validated checked-in DOT tooling artifacts without changing source behavior:

- VS Code extension manifest, language configuration, TextMate grammar, README, and checked-in VSIX artifact.
- GitHub Linguist helper README and language definition patch.

No artifact rebuild was performed because the checked-in VSIX already matches the checked-in extension files.

## Validation

- `file tools/vscode-dot/dot-language-1.0.0.vsix` reports a Zip archive.
- `unzip -l tools/vscode-dot/dot-language-1.0.0.vsix` lists the expected six extension files.
- `node` JSON parse passed for:
  - `tools/vscode-dot/package.json`
  - `tools/vscode-dot/language-configuration.json`
  - `tools/vscode-dot/syntaxes/dot.tmLanguage.json`
- `cmp` confirmed the VSIX contents match the checked-in files for:
  - `package.json`
  - `language-configuration.json`
  - `syntaxes/dot.tmLanguage.json`
  - `README.md`
- Focused Node metadata probe passed:
  - language id is `dot`
  - extension list includes `.dot`
  - grammar path exists
  - grammar scope is `source.dot`
  - line comment is `#`
  - Linguist README and patch both use `.dot` and `source.dot`
  - Linguist sample path exists
- `git diff --check` passed before receipt creation.

## Boundaries

Receipt-only validation slice. No source behavior changes, generated artifact rewrites, package metadata edits, lockfile edits, external audit files, public/account/stream/launch operations, destructive git commands, or credential handling.

## Remaining Blockers

Rust execution validation remains blocked because `cargo` is unavailable on PATH in this VPS shell.

## Next

Continue narrow repo-local validation or documentation hygiene unless a concrete room assignment arrives.
