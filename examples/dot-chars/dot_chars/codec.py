# SPDX-License-Identifier: Apache-2.0
"""Reversible integer <-> character codec, plus the locality-breaking bijection.

dot-chars is the character-based sibling of dot-words. It reuses the SAME two
core primitives dot-words proved, and only swaps the final encoding layer
(integer -> characters instead of integer -> BIP39 words).

Two primitives:

  int_to_chars / chars_to_int
    Base-V positional encoding against a frozen alphabet of V symbols. `count`
    symbols carry the integer range [0, V**count), most-significant symbol first.
    Fully reversible. (Where dot-words uses V = 2048 BIP39 words, dot-chars uses
    V = 1,114,112 Unicode codepoints, 62 alphanumerics, or 1024 frozen emoji.)

  perm / iperm
    A keyless multiplicative bijection on [0, 2**bits): perm(x) = (x*M + C) mod N.
    Because M is odd it is coprime to N = 2**bits, so the map is a permutation
    with a closed-form inverse. Multiplying by a large odd constant scatters
    adjacent inputs far apart, so neighbouring grid cells get unrelated symbols
    (the property that lets you spot a one-symbol typo instead of silently
    landing on the lot next door).

KEY INSIGHT (verified against dot-words): the scramble's only load-bearing
property is the ODDNESS of M (odd => coprime to 2**bits => bijective). It is a
standard reversible integer hash and is INDEPENDENT of the vocabulary. So
dot-chars carries over the identical M, C from dot-words unchanged — the geo
quantiser and the scramble are shared design; only the alphabet changes.

These constants are mirrored from dot-words rather than imported, because
dot-words is a sibling repo (not a published package). The values are identical
on purpose; see README "Relationship to dot-words".
"""

# --- Scramble constants (IDENTICAL to dot-words/dot_words/codec.py) ---------
# Odd => coprime to any power of two => bijective mod 2**bits.
_M = 0x9E3779B97F4A7C15  # golden-ratio (Fibonacci hashing) multiplier, floor(2^64/phi)|1
_C = 0xD1B54A32D192ED03  # odd additive diffusion constant

assert _M & 1 == 1, "M must be odd for the bijection to hold"
assert _C & 1 == 1, "C is conventionally odd (only M's oddness is load-bearing)"


def perm(x: int, bits: int) -> int:
    """Locality-breaking bijection on [0, 2**bits)."""
    n = 1 << bits
    return (x * _M + _C) % n


def iperm(y: int, bits: int) -> int:
    """Inverse of perm on [0, 2**bits)."""
    n = 1 << bits
    m_inv = pow(_M, -1, n)
    return ((y - _C) * m_inv) % n


# --- Base-V positional codec ------------------------------------------------

def int_to_symbols(n: int, count: int, alphabet) -> list:
    """Encode a non-negative integer as exactly `count` symbols (MS-symbol first).

    `alphabet` is an indexable sequence of V distinct symbols (the frozen
    vocabulary). The integer must satisfy 0 <= n < V**count.
    """
    if count < 1:
        raise ValueError("count must be >= 1")
    v = len(alphabet)
    if n < 0 or n >= v ** count:
        raise ValueError(f"{n} does not fit in {count} symbols (base {v})")
    out = []
    for _ in range(count):
        out.append(alphabet[n % v])
        n //= v
    out.reverse()
    return out


def symbols_to_int(symbols, index) -> int:
    """Decode a symbol sequence (MS-symbol first) back to its integer.

    `index` maps each symbol -> its position in the frozen alphabet.
    """
    n = 0
    v = len(index)
    for s in symbols:
        try:
            i = index[s]
        except KeyError:
            raise ValueError(f"{s!r} is not in the frozen alphabet")
        n = n * v + i
    return n
