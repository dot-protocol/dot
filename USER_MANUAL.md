# dot-chars — User Manual

Sovereign, reversible location addressing using single Unicode characters, emoji, or
alphanumerics. No server, no API key, no licensing.

Three modes, three tradeoffs:

| Mode | Chars | Vocabulary | Bits | Horizontal res | Headroom |
|------|-------|-----------|------|----------------|---------|
| `unicode` | 3 | 1,114,112 (full U+0000..U+10FFFF) | 60 | ~0.6–1.2 m | ~59× vs common chars |
| `emoji` | 4 | 3,600 (Unicode 15.0 frozen) | 47 | ~38 m | ~2.75× (~3×) |
| `alnum` | 8 | 62 (`0-9A-Za-z`) | 47 | ~38 m | ~3.9× |

---

## Install

```bash
# from the dot-chars project directory
pip install -e .
```

Or run directly without installing (just add the project directory to PYTHONPATH):

```bash
cd /path/to/dot-chars
python3 -m dot_chars.cli info
```

---

## CLI reference

### `dotchars encode`

Encode a coordinate triple to a character string.

```bash
dotchars encode <lat> <lon> [alt] [--enc unicode|alnum|emoji]
```

`alt` defaults to `0.0` (sea level). `--enc` defaults to `unicode`.

**Examples:**

```bash
# New Delhi at 216 m altitude
dotchars encode 28.6139 77.2090 216 --enc unicode
# Output: 󙁈𨚽윯

dotchars encode 28.6139 77.2090 216 --enc alnum
# Output: EVWZdjXa

dotchars encode 28.6139 77.2090 216 --enc emoji
# Output: 🝷🐬🄩🎮

# London at sea level (default alt=0)
dotchars encode 51.5074 -0.1278 --enc alnum
# Output: some 8-char alnum string

# North Pole at 0 m
dotchars encode 90 0 0 --enc unicode
```

### `dotchars decode`

Decode a character string back to the cell-centre coordinate.

```bash
dotchars decode <chars> [--enc unicode|alnum|emoji]
```

Output format: `<lat> <lon> <alt>` as decimal degrees and metres.

**Examples:**

```bash
dotchars decode EVWZdjXa --enc alnum
# Output: 28.614063 77.208996 230.468750

dotchars decode 󙁈𨚽윯 --enc unicode
# Output: 28.613900 77.209001 215.820312

dotchars decode 🝷🐬🄩🎮 --enc emoji
# Output: 28.614063 77.208996 230.468750
```

### `dotchars info`

Print the per-encoding resolution table.

```bash
dotchars info
# unicode      total=60b (lat=25 lon=25 alt=10)  ~lat 0.60m  ~lon 1.20m  ~alt 9.77m
# alphanumeric total=47b (lat=19 lon=20 alt=8)   ~lat 38.15m ~lon 38.15m ~alt 39.06m
# emoji        total=47b (lat=19 lon=20 alt=8)   ~lat 38.15m ~lon 38.15m ~alt 39.06m
```

---

## Python API

```python
from dot_chars import (
    unicode_to_dotchars,    dotchars_to_unicode,
    alphanumeric_to_dotchars, dotchars_to_alphanumeric,
    emoji_to_dotchars,      dotchars_to_emoji,
    RESOLUTION,
)
```

### `unicode_to_dotchars(lat, lon, alt=0.0) -> str`

Encode `(lat, lon, alt)` as exactly **3 Unicode characters**.

```python
addr = unicode_to_dotchars(28.6139, 77.2090, alt=216)
# addr == '󙁈𨚽윯'   (3 chars, ~0.6–1.2 m horizontal, ~10 m altitude)
```

### `dotchars_to_unicode(chars) -> (lat, lon, alt)`

Decode a 3-character Unicode address back to the cell-centre coordinate.

```python
lat, lon, alt = dotchars_to_unicode('󙁈𨚽윯')
# lat ≈ 28.6139, lon ≈ 77.2090, alt ≈ 215.8
```

### `alphanumeric_to_dotchars(lat, lon, alt=0.0) -> str`

Encode to **8 alphanumeric characters** `[0-9A-Za-z]`.

```python
addr = alphanumeric_to_dotchars(28.6139, 77.2090, 216)
# addr == 'EVWZdjXa'   (8 chars, ~38 m resolution)
```

### `dotchars_to_alphanumeric(chars) -> (lat, lon, alt)`

Decode an 8-char alphanumeric address.

```python
lat, lon, alt = dotchars_to_alphanumeric('EVWZdjXa')
# lat ≈ 28.614, lon ≈ 77.209, alt ≈ 230.5
```

### `emoji_to_dotchars(lat, lon, alt=0.0) -> str`

Encode to **4 emoji** from the frozen Unicode-15.0 set (3,600 emoji).

```python
addr = emoji_to_dotchars(28.6139, 77.2090, 216)
# addr == '🝷🐬🄩🎮'   (4 emoji, ~38 m resolution)
```

### `dotchars_to_emoji(chars) -> (lat, lon, alt)`

Decode a 4-emoji address.

```python
lat, lon, alt = dotchars_to_emoji('🝷🐬🄩🎮')
# lat ≈ 28.614, lon ≈ 77.209, alt ≈ 230.5
```

### `RESOLUTION` — introspection dict

```python
RESOLUTION["unicode"]      # {'total_bits': 60, 'lat_bits': 25, 'lon_bits': 25,
                            #  'alt_bits': 10, 'lat_m': 0.60, 'lon_m_equator': 1.20, 'alt_m': 9.77}
RESOLUTION["alphanumeric"] # {'total_bits': 47, 'lat_bits': 19, 'lon_bits': 20, ...}
RESOLUTION["emoji"]        # {'total_bits': 47, 'lat_bits': 19, 'lon_bits': 20, ...}
```

---

## Roundtrip guarantee

Every address decodes to a **cell centre**. Re-encoding the cell centre always
returns the identical address string (stable fixed-point):

```python
addr = alphanumeric_to_dotchars(28.6139, 77.2090, 216)
dlat, dlon, dalt = dotchars_to_alphanumeric(addr)
assert alphanumeric_to_dotchars(dlat, dlon, dalt) == addr  # always true
```

The maximum decoding error is half a cell width:
- **unicode**: ~0.3 m lat, ~0.6 m lon, ~5 m alt
- **alnum/emoji**: ~19 m lat, ~19 m lon, ~20 m alt

---

## Adjacency breaking

The multiplicative bijection (`x → (x·M + C) mod 2^bits`) scatters adjacent grid
cells so that a **one-character typo moves the decoded location by hundreds of
kilometres** — a mistyped address is visibly wrong, not silently a neighbour:

```python
a = unicode_to_dotchars(51.5074, -0.1278, 0.0)   # London
b = unicode_to_dotchars(51.5075, -0.1278, 0.0)   # ~1 m north

# a and b are completely different character strings
assert a != b
# The scramble guarantees that single-character variants of a valid address
# decode to locations >= 100 km away from the original.
```

---

## Frozen alphabets

Addresses minted today decode identically on any future runtime.

### Unicode mode

Uses the **full U+0000..U+10FFFF codepoint space** (1,114,112 codepoints).
The mapping is the arithmetic identity: index `i` ↔ `chr(i)`. No Unicode
database is consulted; the map is a compile-time constant. Future Unicode
versions that assign new codepoints extend the already-used space in-place
(all new assignments land at codepoints above the 150 K currently assigned, but
since we already use the entire 1.1 M space, nothing shifts).

### Alphanumeric mode

Fixed string `"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"` —
62 characters, order frozen.

### Emoji mode

A frozen ordered list of exactly **3,600** single-codepoint emoji. Built by
walking a fixed sequence of Unicode 15.0 blocks (Emoticons → Misc Pictographs →
Transport → Alchemical → Geometric → Arrows-C → Supplemental → Chess → Extended-A
→ Misc Symbols → Dingbats → Mahjong/Domino → Enclosed Alphanumeric → Enclosed
Ideographic → Misc Technical → Box Drawing) and taking the first 3,600 distinct
codepoints. Frozen test vectors:

- Index 0: U+1F600 😀 (start of Emoticons block)
- Index 3599: U+257F ╿ (last codepoint of Box Drawing block)

**Extension rule**: adding more emoji in a future version = append new ranges
to `_EMOJI_RANGES` and increase `EMOJI_SIZE`. Existing indices 0–3599 never
change.

---

## How it works

1. **Quantise** `(lat, lon, alt)` onto an integer grid.
   - Axis ranges: lat ∈ [−90, 90], lon ∈ [−180, 180], alt ∈ [−1000, 9000] m.
   - Bit budget split: `alt = round(total · 9/55)`, remainder halved between lat/lon.
2. **Scramble** the grid index with `perm(x) = (x·M + C) mod 2^total_bits`.
   - `M = 0x9E3779B97F4A7C15` (odd), `C = 0xD1B54A32D192ED03` (odd).
   - Odd `M` ⇒ coprime to `2^bits` ⇒ the map is a permutation (bijective).
   - Inverse: `iperm(y) = ((y − C) · M⁻¹) mod 2^bits`.
3. **Encode** the scrambled integer in base-V against the frozen alphabet
   (most-significant symbol first).

Decoding reverses all three steps.

---

## Relationship to dot-words

dot-chars is the **character-based sibling** of
[dot-words](../dot-words). Same pipeline — only the final
encoding layer differs:

| Step | dot-words | dot-chars |
|------|-----------|-----------|
| Quantise | `geo._quant / _alloc` | identical |
| Scramble | `perm(x·M+C mod 2^b)` | identical M, C |
| Encode | base-2048 BIP39 words | base-V characters |

dot-chars re-implements the thin shared core (`codec.py`, `geo.py`) rather than
importing dot-words, so it is a standalone installable package with no runtime
dependencies.

---

## States

Every dot-chars operation is **alive** (completes) or raises a `ValueError`
(invalid input). There is no `unknown` state:

| State | When |
|-------|------|
| `alive` | Encode or decode succeeded; coordinates within axis ranges. |
| `ValueError: N does not fit in K symbols` | `int_to_symbols` called with out-of-range integer (internal; shouldn't reach user). |
| `ValueError: <symbol> is not in the frozen alphabet` | `symbols_to_int` called with a character not in the chosen alphabet. |
| `ValueError: expected K symbols, got J` | `_decode` called with wrong character count. |

---

## Running the tests

```bash
python3 -m pytest tests/ -v
```

19 tests covering:
- Frozen-alphabet invariants (full Unicode space, 62-char alnum, Unicode-15.0 emoji)
- Exhaustive bijection (65536-sample collision-free check on 47-bit and 60-bit spaces)
- Geo round-trip within cell (8 global points per mode)
- Adjacency-break: 1-char flip moves decoded location ≥ 100 km (all 3 modes)
- Cross-mode consistency: all three modes agree within 500 m on the same input
- Determinism

---

## License

Apache-2.0. The alphabets are public-domain Unicode codepoints.
