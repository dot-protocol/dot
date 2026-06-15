# Hypatia Receipt: Linguist Helper Validation

Timestamp: 2026-06-15T05:47:00Z

Scope:
- Validated `tools/linguist/README.md` and `tools/linguist/languages.yml.patch` against the checked-in VS Code DOT extension metadata.
- Checked the Linguist helper entry against the DOT TextMate grammar scope and `.dot` extension contribution.
- Checked the referenced sample file path for the Linguist sample instructions.

Validation:
- `node` Linguist helper probe passed:
  - `DOT Protocol` helper entries in the README and patch include `type: programming`, `.dot`, `tm_scope: source.dot`, `ace_mode: text`, and the provisional `language_id: 999001`.
  - VS Code extension metadata contributes language id `dot`, extension `.dot`, and grammar scope `source.dot`.
  - `tools/vscode-dot/syntaxes/dot.tmLanguage.json` contains the advertised keyword, function, and observation-type tokens listed by the helper documentation.
  - `packages/selfhost/programs/temperature.dot` exists and contains representative DOT sample syntax: `observe`, `measure`, `.gate`, and `.pulse`.

Notes:
- An initial probe incorrectly required the single `temperature.dot` sample to exercise every advertised DOT function. The check was corrected to validate full token coverage in the grammar and representative syntax in the sample.
- No helper, grammar, package metadata, or sample source changes were needed.

Blockers:
- `language_id: 999001` remains provisional by design; uniqueness must be checked against upstream GitHub Linguist before any human-approved public PR.
- No public Linguist submission was attempted.

Boundaries:
- No production source edits.
- No generated artifact commits.
- No external audit files, deploys, public posting, account operations, stream/key handling, launch claims, destructive git commands, or secret exposure.
