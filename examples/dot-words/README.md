# dot-words

**Sovereign geo-addressing you can verify — What3Words without the company.**

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Zero dependencies](https://img.shields.io/badge/dependencies-zero-brightgreen.svg)](#install)
[![Tests passing](https://img.shields.io/badge/tests-passing-brightgreen.svg)](tests/test_roundtrip.py)

---

## What & why

dot-words converts any `(lat, lon, alt)` coordinate into **five common English words** and back again — completely, losslessly, offline. No API. No account. No company in the loop.

What3Words is patented and proprietary: their addresses only decode through their API, on their terms. When that API changes price, restricts access, or shuts down, every address depending on it breaks. dot-words uses the public-domain [BIP39](https://github.com/trezor/python-mnemonic/blob/master/src/mnemonic/wordlist/english.txt) wordlist and a closed-form mathematical bijection — the algorithm is here, in this repo, readable and re-derivable. You own the addresses you generate.

The developer is the hero of this story. dot-words is the guide that hands you a geocoder you actually own.

---

## Quickstart

### Install

```bash
pip install git+https://github.com/dot-protocol/dot-words.git
```

Python 3.8+. No external dependencies beyond the standard library and the bundled `english.txt` BIP39 wordlist.

### Reversible round-trip (the core promise)

```python
from dot_words import coordinates_to_dotwords, dotwords_to_coordinates

# Encode: coordinates → 5 words
words = coordinates_to_dotwords(28.6139, 77.2090, alt=216)   # New Delhi
# -> ['dash', 'gloom', 'ripple', 'trap', 'drip']

# Decode: 5 words → cell centre coordinates
lat, lon, alt = dotwords_to_coordinates(words)
# -> (28.6139..., 77.2090..., 220.7)   # returns cell centre
```

**This round-trip works entirely offline.** There is nothing to call.

### CLI

```bash
dotwords encode 28.6139 77.2090 216
# -> dash.gloom.ripple.trap.drip

dotwords decode dash.gloom.ripple.trap.drip
# -> 28.613900 77.209000 220.703125

dotwords encode 28.6139 77.2090 --words 6    # 6 words (~solar-system scale)
```

---

## How it works

Three steps. All reversible.

1. **Quantise** — `(lat, lon, alt)` is mapped onto an integer grid. The 55-bit budget (5 words × 11 bits/word) is split across axes: 23 bits lat, 23 bits lon, 9 bits alt. This gives ~2.4 m latitude, ~4.8 m longitude, and ~19.5 m altitude resolution at 5 words.

2. **Scramble** — The grid index is passed through a keyless multiplicative bijection: `perm(x) = (x × M + C) mod 2^55`, where `M = 0x9E3779B97F4A7C15` (the golden-ratio Fibonacci-hashing multiplier). Because M is odd it is coprime to every power of two, making the map a permutation with a closed-form inverse. Adjacent cells get unrelated words — a one-word slip is visibly wrong, not silently next door.

3. **Encode** — The scrambled integer is written in base-2048 against the BIP39 wordlist.

Decoding is the exact reverse. Source: `dot_words/codec.py` and `dot_words/geo.py`.

> **Why not BLAKE3?** The original R9 design sketch named BLAKE3 for step 2. A hash is one-way; dot-words must round-trip. A modular bijection gives the same adjacency-breaking property *with* a real inverse.

---

## Address space

| Words | Bits | Addresses | Scale |
|-------|------|-----------|-------|
| 5 | 55 | ~3.6 × 10¹⁶ | Earth at ~3 m |
| 6 | 66 | ~7.4 × 10¹⁹ | Solar system |
| 8 | 88 | ~3.1 × 10²⁶ | Galactic |
| 12 | 132 | ~5.4 × 10³⁹ | Intergalactic |

Earth's surface at 3 m needs ~5.7 × 10¹³ cells. Five words provides ~640× headroom, which the quantiser spends on altitude layers.

---

## obs-words (Oracle observation IDs)

The same primitive applies to Oracle observation IDs. The unmemorable nine-digit numeric tail is replaced with three BIP39 words, leaving the human-readable channel and date prefix intact:

```python
from dot_words import obs_id_to_words, words_to_obs_id

obs_id_to_words("OBS-coordination-20260528-851350776")
# -> "OBS-coordination-20260528-ranch.crush.problem"

words_to_obs_id("OBS-coordination-20260528-ranch.crush.problem")
# -> "OBS-coordination-20260528-851350776"
```

Three words = 33 bits, which covers the full < 2³⁰ numeric tail space without collision.

---

## dot-words vs alternatives

| | What3Words | dot-words |
|---|---|---|
| License | Proprietary, patented | Apache-2.0 |
| Decode requires | Their API (account + key) | Nothing — pure offline math |
| Wordlist | ~40,000 words, ~40% differ by one letter, 7,697 plurals | 2,048 curated BIP39 words, no plurals, phonetically distinct |
| Adjacent addresses | Plausibly close — `employer` and `employers` are 4.5 km apart (safety-critical bug) | Locality-broken by design — adjacent cells get unrelated words |
| Altitude | No (2D only) | Yes — 3D native, encodes alt in every address |
| Languages | English-centric, translation indirect | BIP39 has official wordlists in 10+ languages; same index = same cell |
| What happens if company fails | All your addresses break | Nothing — the algorithm is here |
| Algorithm | Secret | Open, re-derivable from first principles in this README |

---

## Datum & tectonic drift (honest disclosure)

dot-words encodes positions in **WGS84** — the same geodetic datum GPS reports. The algorithm names a location in that mathematical reference frame, not a fixed point on the physical crust.

Tectonic plates drift at roughly a few centimetres per year (up to ~7 cm/yr on fast plates like the Pacific). A dot-words address therefore names **a WGS84 position at a point in time**, not a permanently-pinned physical object. Over decades, a fixed rock can move far enough to cross a cell boundary (~3 m at 5 words).

This is an inherent property of any WGS84-based geocoder — **What3Words included** — not a dot-words flaw. The difference is disclosure: we state it. For everyday "meet me here" use the drift is negligible. For multi-decade survey or legal-boundary use, record the measurement epoch alongside the address and apply a plate-motion model (e.g. ITRF/NNR-MORVEL56) when comparing across time.

---

## Run the tests

```bash
python3 tests/test_roundtrip.py
```

Verifies: integer-codec round-trip, exhaustive bijection (12-bit, all 4096 values), geo within-cell accuracy for six reference points, adjacency-breaking, obs-id round-trip.

Expected output:
```
obs    OBS-coordination-20260528-851350776 -> OBS-coordination-20260528-ranch.crush.problem
geo    New Delhi -> dash.gloom.ripple.trap.drip -> (28.61390..., 77.20901..., 220.703125)
ALL TESTS PASSED
```

---

## Star history

[![Star History](https://api.star-history.com/svg?repos=dot-protocol/dot-words&type=Date)](https://star-history.com/#dot-protocol/dot-words&Date)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache-2.0](LICENSE). The BIP39 wordlist (`dot_words/english.txt`) is public domain.
