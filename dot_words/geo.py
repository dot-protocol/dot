# SPDX-License-Identifier: Apache-2.0
"""Sovereign What3Words replacement: (lat, lon, alt) <-> N BIP39 words.

Deterministic, reversible, no central authority, no wordlist licensing.

Address space scales with word count (11 bits each):
    5 words  = 55 bits = ~3.6e16 cells   (Earth surface needs ~5.7e13 at 3 m)
    6 words  = 66 bits                   (solar-system scale headroom)
    8 words  = 88 bits                   (galactic)
   12 words  = 132 bits                  (intergalactic)

v0.1 calibrates the quantiser for Earth. Higher word counts keep the same axis
ratio and simply add precision/range headroom; recalibrating the ALT range for
off-Earth use is left as a future tier.
"""

from .codec import int_to_words, words_to_int, perm, iperm
from .wordlist import BITS_PER_WORD

LAT_MIN, LAT_MAX = -90.0, 90.0
LON_MIN, LON_MAX = -180.0, 180.0
ALT_MIN, ALT_MAX = -1000.0, 9000.0  # metres: Dead Sea shore to above Everest

# At 5 words / 55 bits: lat=23, lon=23, alt=9 -> ~2.4 m lat, ~4.8 m lon, ~19.5 m alt.
_ALT_FRACTION = 9 / 55


def _alloc(words: int) -> tuple[int, int, int]:
    total = BITS_PER_WORD * words
    alt_bits = round(total * _ALT_FRACTION)
    rem = total - alt_bits
    lat_bits = rem // 2
    lon_bits = rem - lat_bits
    return lat_bits, lon_bits, alt_bits


def _quant(value: float, lo: float, hi: float, bits: int) -> int:
    n = 1 << bits
    q = int((value - lo) / (hi - lo) * n)
    return min(max(q, 0), n - 1)


def _dequant(q: int, lo: float, hi: float, bits: int) -> float:
    n = 1 << bits
    return lo + (q + 0.5) * (hi - lo) / n  # cell centre


def coordinates_to_dotwords(lat: float, lon: float, alt: float = 0.0, words: int = 5) -> list[str]:
    lat_bits, lon_bits, alt_bits = _alloc(words)
    ilat = _quant(lat, LAT_MIN, LAT_MAX, lat_bits)
    ilon = _quant(lon, LON_MIN, LON_MAX, lon_bits)
    ialt = _quant(alt, ALT_MIN, ALT_MAX, alt_bits)
    index = (ilat << (lon_bits + alt_bits)) | (ilon << alt_bits) | ialt
    return int_to_words(perm(index, BITS_PER_WORD * words), words)


def dotwords_to_coordinates(words) -> tuple[float, float, float]:
    """Return the cell-centre (lat, lon, alt) for a dotword address."""
    words = list(words)
    count = len(words)
    lat_bits, lon_bits, alt_bits = _alloc(count)
    index = iperm(words_to_int(words), BITS_PER_WORD * count)
    ialt = index & ((1 << alt_bits) - 1)
    ilon = (index >> alt_bits) & ((1 << lon_bits) - 1)
    ilat = (index >> (alt_bits + lon_bits)) & ((1 << lat_bits) - 1)
    lat = _dequant(ilat, LAT_MIN, LAT_MAX, lat_bits)
    lon = _dequant(ilon, LON_MIN, LON_MAX, lon_bits)
    alt = _dequant(ialt, ALT_MIN, ALT_MAX, alt_bits)
    return lat, lon, alt
