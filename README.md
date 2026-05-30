# dot-words

A sovereign, reversible address protocol. Turn any coordinate — or any Oracle
observation ID — into a short, speakable sequence of common English words, and
back again. No central authority, no API, no licensing. Apache-2.0.

It is What3Words without the company: same "three-ish words for a spot on Earth"
ergonomics, but the algorithm is open, the wordlist is the public BIP39 2048-word
list, and anyone can run it offline.

## Why

- **Reversible.** `coords -> words -> coords` round-trips to the cell centre. A
  hash can't do this; a hash is one-way. dot-words uses a closed-form bijection.
- **Locality-broken.** Two 3-metre-adjacent points get *unrelated* words, so a
  one-word slip is visible instead of silently landing next door.
- **Scales past Earth.** More words = more bits. 5 words covers Earth at ~3 m;
  6/8/12 words reach solar-system / galactic / intergalactic address spaces.
- **Sovereign.** No company to sue, rate-limit, or shut down. Embeds in the DOT
  protocol stack (machine identity, SafeRoad device addressing).

## Address space

| Words | Bits | Addresses        | Tier             |
|-------|------|------------------|------------------|
| 5     | 55   | ~3.6e16          | Earth @ ~3 m     |
| 6     | 66   | ~7.4e19          | solar system     |
| 8     | 88   | ~3.1e26          | galactic         |
| 12    | 132  | ~5.4e39          | intergalactic    |

Earth's surface at 3 m needs ~5.7e13 cells; 5 words gives ~640× headroom, spent
on altitude layers.

### Deriving the constants (re-derivable from first principles)

dot-words has no magic numbers in its *sizing* — every quantity above falls out
of two inputs: the BIP39 vocabulary (2048 words) and the word count. The code in
`dot_words/geo.py` + `dot_words/wordlist.py` is the source of truth; this section
shows how to re-derive its constants rather than trust them.

**Total address space (the cell count).** BIP39 has exactly `2048 = 2^11` words,
so each word carries `BITS_PER_WORD = 11` bits (`wordlist.py`). `count` words
therefore address

```
N_cells = 2048^count = 2^(11 · count)
```

For `count = 5`: `2048^5 = 2^55 = 36 028 797 018 963 968 ≈ 3.6e16` cells. This is
the `~3.6e16` in the table — it is not chosen, it is `2^55`.

**Earth's cell requirement at 3 m.** Earth's surface area is `A ≈ 5.10e14 m²`.
A 3 m × 3 m cell is `9 m²`, so a 2-D 3 m grid over the whole sphere needs

```
A / 9 ≈ 5.10e14 / 9 ≈ 5.67e13 cells
```

— the `~5.7e13` in the table.

**Headroom factor.** Dividing the supply by the 2-D demand:

```
2^55 / 5.67e13 ≈ 635.7  ≈ ~640×
```

That surplus is the third dimension. The quantiser (`geo._alloc`) splits the 55
bits as `alt = round(55 · 9/55) = 9`, leaving `46` for the horizontal plane
(`lat = lon = 23`). So:

- horizontal: `2^46 ≈ 7.0e13` cells over the surface (≈ the 3 m demand, with margin)
- vertical:   `2^9 = 512` altitude layers across the `[-1000 m, +9000 m]` range
  (`ALT_MIN..ALT_MAX`), i.e. `10000 / 512 ≈ 19.5 m` per layer

and `2^46 · 2^9 = 2^55`, closing the books. The `9/55` altitude fraction
(`_ALT_FRACTION`) is the one tuned choice; at 5 words it yields the cell sizes the
tests assert — ~2.4 m latitude, ~4.8 m longitude (at the equator), ~19.5 m
altitude. Higher word counts keep the same `9/55` ratio and simply add precision:
6 words → (lat 27, lon 28, alt 11); 8 → (37, 37, 14); 12 → (55, 55, 22).

**The scramble constants are different — and not derived from 2048.** The
locality-breaking bijection `perm(x) = (x·M + C) mod 2^bits` in `codec.py` uses
two *fixed 64-bit odd* constants, independent of the vocabulary size:

```
M = 0x9E3779B97F4A7C15   # golden-ratio (Fibonacci-hashing) multiplier, 2^64/φ
C = 0xD1B54A32D192ED03   # odd additive diffusion constant
```

`M` is `floor(2^64 / φ)` made odd — the standard Fibonacci-hashing multiplier,
chosen because multiplying by `2^64/φ` maximally scatters adjacent integers (the
adjacency-breaking property). The *only* property either constant must satisfy
for correctness is **oddness**: an odd number is coprime to every power of two, so
`x ↦ M·x + C (mod 2^bits)` is a bijection with the closed-form inverse in `iperm`.
Their specific values affect *diffusion quality*, not reversibility — swap in any
other odd `M`, `C` and the codec still round-trips. They are documented here so a
reader knows they are a deliberate, re-derivable choice (golden-ratio hashing),
not an opaque seed.

## Usage

```python
from dot_words import coordinates_to_dotwords, dotwords_to_coordinates

w = coordinates_to_dotwords(28.6139, 77.2090, alt=216)   # New Delhi
# -> ['dash', 'gloom', 'ripple', 'trap', 'drip']
dotwords_to_coordinates(w)
# -> (28.6139..., 77.2090..., 220.7)   # cell centre
```

```python
from dot_words import obs_id_to_words, words_to_obs_id

obs_id_to_words("OBS-coordination-20260528-851350776")
# -> "OBS-coordination-20260528-ranch.crush.problem"
words_to_obs_id("OBS-coordination-20260528-ranch.crush.problem")
# -> "OBS-coordination-20260528-851350776"
```

CLI:

```bash
dotwords encode 28.6139 77.2090 216
dotwords decode dash.gloom.ripple.trap.drip
dotwords obs   OBS-coordination-20260528-851350776
dotwords unobs OBS-coordination-20260528-ranch.crush.problem
```

## How it works

1. **Quantise** `(lat, lon, alt)` onto an integer grid (bit budget split per axis
   by word count).
2. **Scramble** the grid index with a keyless multiplicative bijection
   `x -> (x*M + C) mod 2^bits` (M odd ⇒ coprime ⇒ invertible). This breaks
   adjacency so neighbouring cells get unrelated words.
3. **Encode** the scrambled integer in base-2048 against the BIP39 wordlist.

Decoding runs all three steps in reverse. See `dot_words/codec.py` and
`dot_words/geo.py`.

> The original R9 sketch named BLAKE3 for step 2. A hash isn't invertible and
> dot-words must round-trip, so a modular bijection is used instead — it gives the
> same adjacency-breaking property *with* a real inverse. BLAKE3 can later key a
> Feistel variant for a secret-salted address space.

## Datum & tectonic drift (honest disclosure)

dot-words encodes positions in **WGS84** — the same geodetic datum GPS reports.
`(lat, lon, alt)` in, `(lat, lon, alt)` out, all WGS84. The datum is a mathematical
reference frame, not the ground itself.

The Earth's crust moves relative to that frame. Tectonic plates drift at roughly a
few centimetres per year — up to ~7 cm/yr on the fast ones (e.g. the Pacific
plate) — so a fixed physical rock slowly slides away from its WGS84 coordinates
over time. A dot-words address therefore names **a position in the WGS84 datum at
a point in time**, not a permanently-pinned physical object. Over a human lifetime
the divergence is metres; at dot-words' ~3 m cell, a point can cross a cell
boundary on the order of decades.

This is an inherent property of any datum-based geocoder, **what3words included** —
their addresses are WGS84 too and carry the same drift. The difference is
disclosure: we state it. If you need a position fixed to the moving plate rather
than the datum, pair the address with an epoch (the date it was measured) and
apply a plate-motion model (e.g. ITRF/NNR-MORVEL56) to transform between epochs.
For everyday "meet me here" use the drift is negligible; for multi-decade survey
or legal-boundary use, record the epoch.

## obs-words

`obs-words` (in `dot_words/obs.py`) is the same primitive applied to Oracle
observation IDs: it replaces only the unmemorable 9-digit numeric tail with 3
BIP39 words, leaving the human-readable channel + date prefix intact. 3 words =
33 bits covers the <2^30 tail space uniquely and reversibly.

## Test

```bash
python3 tests/test_roundtrip.py
```

Verifies integer-codec round-trip, exhaustive bijection (12-bit), geo within-cell
accuracy, adjacency-breaking, and obs-id round-trip.

## License

Apache-2.0. Wordlist is the public-domain BIP39 English list (`dot_words/english.txt`).
