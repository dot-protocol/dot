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
