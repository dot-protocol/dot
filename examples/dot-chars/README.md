# dot-chars

A sovereign, reversible location-addressing protocol — the **character-based
sibling of [dot-words](../dot-words)**. Turn any coordinate into a short string of
Unicode characters, alphanumerics, or emoji, and back again. No central
authority, no API, no licensing. Apache-2.0.

Where dot-words speaks BIP39 words ("dash.gloom.ripple.trap.drip"), dot-chars
uses **smaller atoms** — single characters — for the same job:

```
unicode  28.6139, 77.2090, 216  ->  󙁈𨚽윯           (3 chars)
alnum    28.6139, 77.2090, 216  ->  EVWZdjXa        (8 chars)
emoji    28.6139, 77.2090, 216  ->  🝷🐬🄩🎮          (4 emoji)
```

…all of which decode back to the cell centre near `(28.6139, 77.2090, 216)`.

## Relationship to dot-words (shared core)

dot-chars and dot-words are the **same pipeline** — `quantise -> scramble ->
encode` — with **only the last step swapped**:

| Step | dot-words | dot-chars | Shared? |
|------|-----------|-----------|---------|
| 1. Quantise `(lat,lon,alt)` -> grid index | `geo._quant` / `_alloc` | identical | ✅ same design |
| 2. Scramble (locality-break) | `perm(x) = (x·M + C) mod 2^bits` | identical M, C | ✅ same constants |
| 3. Encode integer -> atoms | base-2048 BIP39 words | base-V characters | ⛔ the only difference |

**Why the scramble is shared.** The locality-breaking bijection's *only*
load-bearing property is the **oddness of M** (odd ⇒ coprime to `2^bits` ⇒
bijective, with the closed-form inverse in `iperm`). It is a standard reversible
integer hash and is **independent of the vocabulary**. So dot-chars carries over
the identical `M = 0x9E3779B97F4A7C15`, `C = 0xD1B54A32D192ED03` unchanged. The
geo quantiser and axis ranges (`LAT/LON/ALT_MIN/MAX`, the `9/55` altitude
fraction) are likewise mirrored from dot-words verbatim.

> **Implementation note.** dot-words is a sibling repo, not a published package,
> so dot-chars **re-implements the thin shared core** (scramble + quantiser) in
> `dot_chars/codec.py` + `dot_chars/geo.py` rather than importing it. The values
> are identical on purpose. This keeps dot-chars a standalone, installable unit
> while documenting the shared lineage. **No change to dot-words was required.**

## The three encodings

| Encoding | Atoms | Vocabulary V | Bits/atom | Total bits | Horizontal res | Altitude res |
|----------|-------|--------------|-----------|------------|----------------|--------------|
| `unicode` | 3 chars | 1,114,112 | ~20.087 | 60 | **~0.6–1.2 m** | ~9.8 m |
| `alphanumeric` | 8 chars | 62 | ~5.954 | 47 | **~38 m** | ~39 m |
| `emoji` | 4 emoji | 3,600 (Unicode 15.0 frozen) | ~11.81 | 47 | **~38 m** | ~39 m |

(Resolutions printed by `dotchars info`.)

### Deriving the constants (re-derivable from first principles)

Like dot-words, dot-chars has no magic numbers in its *sizing* — everything falls
out of the vocabulary size `V` and the atom count, against the same physical
demand (Earth's surface).

**Capacity per encoding.** `count` atoms of a `V`-symbol vocabulary address up to
`V^count` distinct values. We pick `total_bits = floor(log2(V^count))` — the
largest power-of-two grid that fits in the atom budget — and run the scramble over
`[0, 2^total_bits)`. Because `2^total_bits ≤ V^count`, the scrambled index always
fits back into `count` atoms.

- **unicode**: `V = 1,114,112 = 0x110000` (the full Unicode codepoint space).
  `log2(V) = 20.087`, so `V^3 = 1.38e18 ≈ 2^60.26` → `total_bits = 60`.
  Earth at 3 m needs only `2^45.7` cells, so 60 bits is **~14 doublings of
  headroom** — spent on sub-metre precision + altitude.
- **alphanumeric**: `V = 62` (`0-9A-Za-z`). `V^8 = 2.18e14 ≈ 2^47.63` →
  `total_bits = 47`. That is just `2^1.3 ≈ 2.5×` above the bare 3 m surface
  demand (`2^45.7`) before any altitude — **not enough for both 3 m and altitude**
  (see the honest tradeoff below).
- **emoji**: a frozen `V = 3,600` set. `log2(V) ≈ 11.81`, so `V^4 ≈ 2^47.2` →
  `total_bits = 47`. That is `≈ 2.75×` above the Earth-3 m demand (spec: ~3×).
  The set is built by walking 14 contiguous Unicode 15.0 blocks (Emoticons,
  Misc Pictographs, Transport, Alchemical, Geometric, Arrows-C, Supplemental,
  Chess, Extended-A, Misc Symbols, Dingbats, Mahjong/Domino, Enclosed Alphanumeric,
  Enclosed Ideographic, Misc Technical, Box Drawing) and taking the first 3,600
  distinct codepoints. Resolution is the same as alphanumeric (~38 m horizontal).

**Bit allocation per axis.** Each encoding splits `total_bits` exactly as
dot-words does (`geo._alloc`): `alt = round(total · 9/55)`, then the remainder is
halved between lat and lon (lon gets the odd bit). So:

| Encoding | total | lat bits | lon bits | alt bits | alt layers |
|----------|-------|----------|----------|----------|------------|
| unicode | 60 | 25 | 25 | 10 | 1024 |
| alphanumeric | 47 | 19 | 20 | 8 | 256 |
| emoji | 47 | 19 | 20 | 8 | 256 |

(unicode: `lat = 180°/2^25 ≈ 5.4e-6° ≈ 0.6 m`; `lon` at the equator `≈ 1.2 m`;
`alt = 10000 m / 1024 ≈ 9.8 m`. alnum/emoji share 47 bits and the same axis split.)

**The scramble constants are NOT derived from V** — they are the same fixed 64-bit
odd constants dot-words uses (`M = floor(2^64/φ)|1`, `C` odd). Only oddness matters
for correctness; the specific golden-ratio value governs *diffusion quality*, not
reversibility. Swap in any other odd `M, C` and the codec still round-trips.

### Honest precision tradeoff (alphanumeric)

- **8 alphanumerics = 47 bits ≈ 38 m horizontal.** A 62-symbol alphabet carries
  only ~5.95 bits/char, so 8 chars cannot match dot-words' 5-word / 3 m precision.
  To reach 3 m + altitude with this alphabet you would need **~10 chars**
  (`62^10 ≈ 2^59.5`). 8 chars is a good "type it on a keyboard" size; if you need
  sub-metre precision, use `unicode` (3 chars).

- **4 emoji = 47 bits ≈ 38 m horizontal** (same bit budget as alphanumeric, same
  resolution). The expanded 3,600-emoji set covers the full `total_bits = 47`
  budget — no precision penalty for using emoji over alphanumeric. The tradeoff is
  readability vs. portability: emoji look memorable, but not every system renders
  all 3,600 codepoints cleanly.

## Frozen at Unicode 15.0 (immutability discipline)

The codepoint↔index mapping is **frozen at Unicode 15.0**, the same discipline
dot-words applies to its 2048-word BIP39 list. An address minted today must decode
identically forever, on any runtime.

- **unicode**: uses the **full 1,114,112-codepoint space** (`U+0000..U+10FFFF`),
  **not** only the ~150 K currently-assigned codepoints. The mapping is the pure
  identity (`index i ↔ chr(i)`), so it is a fixed arithmetic constant that **no
  future Unicode revision can shift**. (This is why we use the whole space: it
  makes the bijection runtime-independent.)
- **alphanumeric**: a fixed 62-character string `0-9A-Za-z` in that exact order.
- **emoji**: a frozen ordered list of exactly **3,600** single-codepoint characters
  built from 16 contiguous Unicode 15.0 blocks (see `_EMOJI_RANGES` in
  `dot_chars/alphabets.py`). Frozen test vectors:
  - Index 0: `U+1F600 😀` (start of Emoticons block)
  - Index 3599: `U+257F ╿` (last codepoint of Box Drawing block)

**Extension rule:** to grow the emoji vocabulary past 3,600, append new ranges to
`_EMOJI_RANGES` and increase `EMOJI_SIZE`. Existing indices 0–3599 **never change**.
(The local Python may report a newer Unicode version; dot-chars ignores the runtime
database and determines the mapping purely from explicit ranges + count.)

## Usage

```python
from dot_chars import (
    unicode_to_dotchars, dotchars_to_unicode,
    alphanumeric_to_dotchars, dotchars_to_alphanumeric,
    emoji_to_dotchars, dotchars_to_emoji,
)

unicode_to_dotchars(28.6139, 77.2090, alt=216)   # New Delhi -> 3 chars
dotchars_to_unicode("󙁈𨚽윯")                       # -> (28.6139…, 77.2090…, 215.8)

alphanumeric_to_dotchars(28.6139, 77.2090, 216)  # -> 'EVWZdjXa'
emoji_to_dotchars(28.6139, 77.2090, 216)         # -> '🝷🐬🄩🎮'
```

CLI:

```bash
dotchars encode 28.6139 77.2090 216 --enc unicode
dotchars encode 28.6139 77.2090 216 --enc alnum
dotchars encode 28.6139 77.2090 216 --enc emoji
dotchars decode EVWZdjXa --enc alnum
dotchars info        # per-encoding resolution table
```

## How it works

1. **Quantise** `(lat, lon, alt)` onto an integer grid (bit budget split per axis
   exactly as dot-words does).
2. **Scramble** the grid index with the keyless multiplicative bijection
   `x -> (x·M + C) mod 2^total_bits` (M odd ⇒ coprime ⇒ invertible). Breaks
   adjacency so neighbouring cells get unrelated atoms — a one-atom typo is
   visible, not a silent jump next door.
3. **Encode** the scrambled integer in base-V against the frozen alphabet.

Decoding runs all three in reverse. See `dot_chars/codec.py` and `dot_chars/geo.py`.

## Datum & tectonic drift

dot-chars encodes positions in **WGS84** (the GPS datum), identical to dot-words.
A dot-chars address names a position in the WGS84 datum at a point in time; the
crust drifts ~cm/yr relative to the datum, so over decades a fixed physical point
can cross a cell boundary. This is inherent to any datum-based geocoder
(what3words included). For multi-decade or legal use, pair the address with an
epoch and a plate-motion model. See dot-words' README for the full discussion.

## Test

```bash
python3 tests/test_roundtrip.py     # or: python3 -m pytest tests/ -q
```

19 tests covering:
- Frozen-alphabet invariants (full Unicode space, 62-char alnum, Unicode-15.0 emoji vector)
- Exhaustive bijection (65 536-sample collision-free check on 47-bit and 60-bit spaces)
- Base-V integer round-trip (all three alphabets)
- Geo within-cell round-trip (8 global points per mode)
- Adjacency-break: 1-char flip moves decoded location ≥ 100 km (all 3 modes)
- Cross-mode consistency: all three modes agree within 500 m on the same input
- Determinism

## License

Apache-2.0. The alphabets are public-domain Unicode codepoints.
