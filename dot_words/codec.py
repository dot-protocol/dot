# SPDX-License-Identifier: Apache-2.0
"""Reversible integer <-> BIP39-word codec, plus a locality-breaking bijection.

Two primitives:

  int_to_words / words_to_int
    Base-2048 positional encoding. `count` words carry exactly 11*count bits,
    most-significant word first. Fully reversible.

  perm / iperm
    A keyless multiplicative bijection on [0, 2**bits): perm(x) = (x*M + C) mod N.
    Because M is odd it is coprime to N = 2**bits, so the map is a permutation
    with a closed-form inverse. Multiplying by a large odd constant scatters
    adjacent inputs far apart, so neighbouring grid cells get unrelated words
    (the property that lets you spot a one-word typo instead of silently landing
    on the lot next door).

Note on BLAKE3: the R9 sketch named BLAKE3 for the scramble, but a hash is not
invertible and dot-words must round-trip. A modular bijection gives the same
adjacency-breaking property *and* a real inverse. BLAKE3 can later key a Feistel
variant if a secret-salted address space is ever wanted.
"""

from .wordlist import WORDS, WORD_INDEX, BITS_PER_WORD

_MASK = (1 << BITS_PER_WORD) - 1  # 0x7FF

# Fixed odd constants. Odd => coprime to any power of two => bijective mod 2**bits.
_M = 0x9E3779B97F4A7C15  # golden-ratio (Fibonacci hashing) multiplier
_C = 0xD1B54A32D192ED03  # odd additive diffusion constant


def int_to_words(n: int, count: int) -> list[str]:
    """Encode a non-negative integer as exactly `count` BIP39 words (MSW first)."""
    if count < 1:
        raise ValueError("count must be >= 1")
    if n < 0 or n >= (1 << (BITS_PER_WORD * count)):
        raise ValueError(f"{n} does not fit in {count} words ({BITS_PER_WORD * count} bits)")
    out = []
    for _ in range(count):
        out.append(WORDS[n & _MASK])
        n >>= BITS_PER_WORD
    out.reverse()
    return out


def words_to_int(words) -> int:
    """Decode a BIP39 word sequence (MSW first) back to its integer."""
    n = 0
    for w in words:
        try:
            idx = WORD_INDEX[w]
        except KeyError:
            raise ValueError(f"{w!r} is not a BIP39 word")
        n = (n << BITS_PER_WORD) | idx
    return n


def perm(x: int, bits: int) -> int:
    """Locality-breaking bijection on [0, 2**bits)."""
    n = 1 << bits
    return (x * _M + _C) % n


def iperm(y: int, bits: int) -> int:
    """Inverse of perm on [0, 2**bits)."""
    n = 1 << bits
    m_inv = pow(_M, -1, n)
    return ((y - _C) * m_inv) % n
