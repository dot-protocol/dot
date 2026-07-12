# Contributing to dot-words

dot-words is an Apache-2.0 open protocol. Contributions are welcome.

## Running the tests

```bash
git clone https://github.com/dot-protocol/dot-words
cd dot-words
pip install -e .
python3 tests/test_roundtrip.py
```

No additional test dependencies. All tests are in `tests/test_roundtrip.py` and exercise:

- Integer codec round-trip (1, 3, 5, 8, 12 words)
- Exhaustive bijection check at 12 bits (4,096 values)
- Geo within-cell accuracy for six reference coordinates
- Adjacency-breaking (neighbouring cells produce unrelated words)
- obs-id aliasing round-trip

All five must pass before opening a pull request.

## Code style

- Standard library only — no new runtime dependencies.
- Follow the existing patterns in `codec.py` and `geo.py`: explicit types, short functions, a docstring explaining the *why* not just the *what*.
- Any change to the quantiser constants (`_ALT_FRACTION`, `_alloc`) or the bijection constants (`_M`, `_C`) is a **breaking change** — it remaps every existing address. Such changes require a new word-count tier or a versioned codec, not a quiet edit.

## Good first issues

- **BIP39 language support** — BIP39 has official wordlists in Chinese (simplified + traditional), Czech, French, Italian, Japanese, Korean, Portuguese, Spanish. A language-aware codec that maps the same index to the right language would let non-English speakers use addresses in their own language while remaining interoperable.
- **`--words` validation in the CLI** — currently accepts any integer; add a check that rejects word counts where the address space is too small for Earth (< 5 words).
- **Plate-motion helper** — a small utility that takes an address plus an ITRF epoch and adjusts for tectonic drift, enabling multi-decade survey use.
- **pytest wrapper** — the test file is self-contained; wrapping it so `pytest` discovers it would lower the contribution barrier.

## Submitting changes

1. Fork the repo and create a branch from `main`.
2. Make your change, add or update tests as appropriate.
3. Run `python3 tests/test_roundtrip.py` — all tests must pass.
4. Open a pull request with a clear description of what changes and why.

## Developer Certificate of Origin (DCO)

By contributing, you certify that:

- The contribution is your original work or you have the right to submit it.
- You license your contribution under the Apache-2.0 license that covers this project.

Add a `Signed-off-by` line to your commit message:

```
Signed-off-by: Your Name <your@email.example>
```

## License

All contributions are licensed Apache-2.0 and the BIP39 wordlist (`dot_words/english.txt`) remains public domain.
