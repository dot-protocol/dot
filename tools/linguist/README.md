# GitHub Linguist — DOT Language Registration

## How to Submit

1. Fork https://github.com/github-linguist/linguist
2. Add the DOT Protocol entry to `lib/linguist/languages.yml` (alphabetically under "D")
3. Add the TextMate grammar from `tools/vscode-dot/syntaxes/dot.tmLanguage.json` to `vendor/grammars/`
4. Add a sample `.dot` file to `samples/DOT Protocol/`
5. Submit PR with title: "Add DOT Protocol language"

## Entry for languages.yml

```yaml
DOT Protocol:
  type: programming
  color: "#818cf8"
  extensions:
    - ".dot"
  tm_scope: source.dot
  ace_mode: text
  language_id: 999001
```

## Sample file (for samples/ directory)

Use `packages/selfhost/programs/temperature.dot` from the main repo.

## Reference

- Repository: https://github.com/dot-protocol/dot
- Spec: The DOT language has 4 bases (STCV), 7 functions, 5 observation types
- 3,048+ tests, Apache-2.0 licensed
