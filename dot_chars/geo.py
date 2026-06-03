# SPDX-License-Identifier: Apache-2.0
"""Sovereign location addressing: (lat, lon, alt) <-> N characters.

The character-based sibling of dot-words. Same reversible pipeline:

    quantise -> scramble (perm) -> encode in a frozen alphabet

The geo quantiser and the scramble are SHARED design with dot-words (mirrored,
not reinvented). Only the final encoding layer differs: dot-words emits BIP39
words; dot-chars emits Unicode characters / alphanumerics / emoji.

WGS84 datum, identical axis ranges to dot-words. See README for the full
derivation of vocabulary sizes, bit-allocation, and per-encoding resolution.
"""

from .codec import int_to_symbols, symbols_to_int, perm, iperm
from .alphabets import (
    UNICODE_SIZE, UNICODE_ALPHABET, UNICODE_INDEX,
    ALNUM_ALPHABET, ALNUM_INDEX,
    EMOJI_SIZE, EMOJI_ALPHABET, EMOJI_INDEX,
)

# --- Axis ranges (identical to dot-words/dot_words/geo.py) ------------------
LAT_MIN, LAT_MAX = -90.0, 90.0
LON_MIN, LON_MAX = -180.0, 180.0
ALT_MIN, ALT_MAX = -1000.0, 9000.0  # metres: Dead Sea shore to above Everest

# Same altitude fraction dot-words tuned at 5 words / 55 bits (alt=9, rem=46).
_ALT_FRACTION = 9 / 55


def _alloc(total_bits: int) -> tuple[int, int, int]:
    """Split a total bit budget into (lat, lon, alt), mirroring dot-words._alloc."""
    alt_bits = round(total_bits * _ALT_FRACTION)
    rem = total_bits - alt_bits
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


# --- Per-encoding configuration --------------------------------------------
# total_bits is the largest power-of-two grid that fits in `count` symbols of the
# given vocabulary, i.e. the largest B with 2**B <= V**count. The scrambled grid
# index lives in [0, 2**B); it always fits in `count` symbols because
# 2**B <= V**count. See README "Deriving the constants".

#                  vocab_size,    count, total_bits, alphabet,         index
_UNICODE_CFG = (UNICODE_SIZE,     3,     60,         UNICODE_ALPHABET, UNICODE_INDEX)
_ALNUM_CFG   = (62,               8,     47,         ALNUM_ALPHABET,   ALNUM_INDEX)
_EMOJI_CFG   = (EMOJI_SIZE,       4,     47,         EMOJI_ALPHABET,   EMOJI_INDEX)
# Note: EMOJI total_bits = floor(log2(3600^4)) = 47; same bit budget as alphanumeric.


def _encode(lat, lon, alt, cfg):
    vocab, count, total_bits, alphabet, _index = cfg
    assert (1 << total_bits) <= vocab ** count, "grid does not fit in symbol budget"
    lat_bits, lon_bits, alt_bits = _alloc(total_bits)
    ilat = _quant(lat, LAT_MIN, LAT_MAX, lat_bits)
    ilon = _quant(lon, LON_MIN, LON_MAX, lon_bits)
    ialt = _quant(alt, ALT_MIN, ALT_MAX, alt_bits)
    index = (ilat << (lon_bits + alt_bits)) | (ilon << alt_bits) | ialt
    scrambled = perm(index, total_bits)
    return int_to_symbols(scrambled, count, alphabet)


def _decode(symbols, cfg):
    vocab, count, total_bits, _alphabet, index_map = cfg
    symbols = list(symbols)
    if len(symbols) != count:
        raise ValueError(f"expected {count} symbols, got {len(symbols)}")
    lat_bits, lon_bits, alt_bits = _alloc(total_bits)
    scrambled = symbols_to_int(symbols, index_map)
    grid = iperm(scrambled, total_bits)
    ialt = grid & ((1 << alt_bits) - 1)
    ilon = (grid >> alt_bits) & ((1 << lon_bits) - 1)
    ilat = (grid >> (alt_bits + lon_bits)) & ((1 << lat_bits) - 1)
    lat = _dequant(ilat, LAT_MIN, LAT_MAX, lat_bits)
    lon = _dequant(ilon, LON_MIN, LON_MAX, lon_bits)
    alt = _dequant(ialt, ALT_MIN, ALT_MAX, alt_bits)
    return lat, lon, alt


# --- Public API (the R36 spec) ---------------------------------------------

def unicode_to_dotchars(lat: float, lon: float, alt: float = 0.0) -> str:
    """(lat, lon, alt) -> 3 Unicode characters. ~sub-metre resolution."""
    return "".join(_encode(lat, lon, alt, _UNICODE_CFG))


def dotchars_to_unicode(chars) -> tuple[float, float, float]:
    """3 Unicode characters -> cell-centre (lat, lon, alt)."""
    return _decode(list(chars), _UNICODE_CFG)


def alphanumeric_to_dotchars(lat: float, lon: float, alt: float = 0.0) -> str:
    """(lat, lon, alt) -> 8 alphanumeric chars [0-9A-Za-z]. ~40 m resolution."""
    return "".join(_encode(lat, lon, alt, _ALNUM_CFG))


def dotchars_to_alphanumeric(chars) -> tuple[float, float, float]:
    """8 alphanumeric chars -> cell-centre (lat, lon, alt)."""
    return _decode(list(chars), _ALNUM_CFG)


def emoji_to_dotchars(lat: float, lon: float, alt: float = 0.0) -> str:
    """(lat, lon, alt) -> 4 emoji (frozen 1024-set). ~150 m resolution."""
    return "".join(_encode(lat, lon, alt, _EMOJI_CFG))


def dotchars_to_emoji(chars) -> tuple[float, float, float]:
    """4 emoji -> cell-centre (lat, lon, alt)."""
    return _decode(list(chars), _EMOJI_CFG)


# Resolution metadata (computed once, for introspection / docs / CLI).
def _resolution(cfg):
    _v, _c, total_bits, *_ = cfg
    lat_bits, lon_bits, alt_bits = _alloc(total_bits)
    return {
        "total_bits": total_bits,
        "lat_bits": lat_bits,
        "lon_bits": lon_bits,
        "alt_bits": alt_bits,
        "lat_m": 180.0 / (1 << lat_bits) * 111_000,
        "lon_m_equator": 360.0 / (1 << lon_bits) * 111_000,
        "alt_m": (ALT_MAX - ALT_MIN) / (1 << alt_bits),
    }


RESOLUTION = {
    "unicode": _resolution(_UNICODE_CFG),
    "alphanumeric": _resolution(_ALNUM_CFG),
    "emoji": _resolution(_EMOJI_CFG),
}
