# USER_MANUAL — dot-protocol/dot-words

## What it is

A Python library and CLI that converts geographic coordinates (lat/lon/alt) and Oracle observation IDs into short, reversible, speakable sequences of BIP39 English words — and back. A What3Words replacement with no central authority, no API, and no licensing restrictions. Also converts the numeric tail of Oracle `OBS-*` IDs into 3-word aliases.

## Install

```bash
pip install git+https://github.com/dot-protocol/dot-words.git
# or from source:
git clone https://github.com/dot-protocol/dot-words
cd dot-words
pip install -e .
```

Python 3.8+. No external dependencies beyond the standard library and the bundled `english.txt` BIP39 wordlist.

## CLI commands

```bash
# Coordinates → dot-words (default 5 words, ~3 m on Earth)
dotwords encode 28.6139 77.2090
# -> dash.gloom.ripple.trap.drip

dotwords encode 28.6139 77.2090 216          # with altitude
dotwords encode 28.6139 77.2090 --words 6    # 6 words (~solar system scale)

# Dot-words → coordinates (returns lat lon alt)
dotwords decode dash.gloom.ripple.trap.drip
# -> 28.613900 77.209000 0.0

dotwords decode "dash gloom ripple trap drip"   # space-separated also accepted

# Oracle obs-id → speakable id
dotwords obs OBS-coordination-20260528-851350776
# -> OBS-coordination-20260528-ranch.crush.problem

# Speakable id → obs-id
dotwords unobs OBS-coordination-20260528-ranch.crush.problem
# -> OBS-coordination-20260528-851350776
```

## Python API

```python
from dot_words import (
    coordinates_to_dotwords,   # (lat, lon, alt, n_words) -> list[str]
    dotwords_to_coordinates,   # (words) -> (lat, lon, alt)
    obs_id_to_words,           # (obs_id: str) -> str   (full aliased id)
    words_to_obs_id,           # (spoken_id: str) -> str
    tail_to_words,             # (numeric_tail: int, bits=33) -> list[str]
    words_to_tail,             # (words: list[str], bits=33) -> int
    int_to_words,              # (n: int, n_words: int, bits: int) -> list[str]
    words_to_int,              # (words: list[str], bits: int) -> int
)

# Geo round-trip
words = coordinates_to_dotwords(28.6139, 77.2090, alt=216)
# -> ['dash', 'gloom', 'ripple', 'trap', 'drip']

lat, lon, alt = dotwords_to_coordinates(words)
# -> (28.613900..., 77.209000..., 220.7)   # cell centre

# Oracle obs-id aliasing
aliased = obs_id_to_words("OBS-coordination-20260528-851350776")
# -> "OBS-coordination-20260528-ranch.crush.problem"

original = words_to_obs_id("OBS-coordination-20260528-ranch.crush.problem")
# -> "OBS-coordination-20260528-851350776"
```

## Address space

| `n_words` | Bits | Approx. addresses | Scale |
|-----------|------|-------------------|-------|
| 5 | 55 | ~3.6e16 | Earth surface at ~3 m |
| 6 | 66 | ~7.4e19 | Solar system |
| 8 | 88 | ~3.1e26 | Galactic |
| 12 | 132 | ~5.4e39 | Intergalactic |

Earth at 3 m needs ~5.7e13 cells; 5 words gives ~640× headroom for altitude layers.

## How the codec works

1. **Quantise** `(lat, lon, alt)` into an integer grid (bits split across axes based on `n_words`).
2. **Scramble** with a keyless multiplicative bijection `x -> (x * M + C) mod 2^bits` (M is odd, so it is coprime and invertible). This breaks spatial adjacency — neighbouring cells get unrelated words.
3. **Encode** the scrambled integer in base-2048 against the BIP39 wordlist (`dot_words/english.txt`).

Decoding runs all three steps in reverse. The bijection is deterministic and needs no key; it is not a hash — it is a reversible permutation. Source: `dot_words/codec.py`, `dot_words/geo.py`.

For obs-ids: only the numeric tail (last segment after the final `-`) is encoded; the human-readable channel + date prefix is preserved verbatim.

## Observe state / health

This is a pure library — no server, no daemon, no state file beyond the bundled wordlist. To verify the library is working:

```bash
python3 tests/test_roundtrip.py
# Tests: integer codec round-trip, exhaustive bijection (12-bit),
#        geo within-cell accuracy, adjacency-breaking, obs-id round-trip.
# All pass = library is functional.
```

Version:

```python
import dot_words
print(dot_words.__version__)   # -> "0.1.0"
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `dotwords decode` returns coordinates far from original | Normal: decode returns cell *centre*, not original point | Confirm distance < cell size for the word count used (~3 m for 5 words) |
| `words_to_obs_id` raises ValueError | Word not in BIP39 wordlist | Ensure words came from `obs_id_to_words`; wordlist is the standard 2048-word BIP39 list |
| `import dot_words` fails with ModuleNotFoundError | Not installed | `pip install -e .` from repo root, or `pip install git+...` |
| Adjacent coordinates produce similar words | Bijection not applied | Indicates codec regression; run `python3 tests/test_roundtrip.py` to confirm adjacency-breaking |
| `dotwords encode` with `--words 3` produces non-unique addresses | 3 words = 33 bits — collisions on Earth surface | Use `--words 5` (default) for Earth; use 3 words only for obs-id tails where the space is <2^30 |
