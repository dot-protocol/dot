# SPDX-License-Identifier: Apache-2.0
"""obs-words v0.1 — speakable aliases for Oracle observation IDs.

Oracle IDs look like:  OBS-coordination-20260528-851350776
The channel + date are already human-skimmable; only the 9-digit numeric tail is
unmemorable and unspeakable. obs-words replaces *just the tail* with 3 BIP39
words, keeping the prefix intact:

    OBS-coordination-20260528-851350776
        -> OBS-coordination-20260528-canyon.ribbon.helmet   (illustrative)

3 words = 33 bits = ~8.6e9 > the 10-digit (<2**30) tail space, so every tail maps
to a unique triple and back. Same scramble as geo, so consecutive tails get
unrelated words.
"""

from .codec import int_to_words, words_to_int, perm, iperm
from .wordlist import BITS_PER_WORD

DEFAULT_WORDS = 3


def tail_to_words(tail: int, words: int = DEFAULT_WORDS) -> list[str]:
    bits = BITS_PER_WORD * words
    if tail < 0 or tail >= (1 << bits):
        raise ValueError(f"tail {tail} does not fit in {words} words ({bits} bits)")
    return int_to_words(perm(tail, bits), words)


def words_to_tail(words) -> int:
    words = list(words)
    return iperm(words_to_int(words), BITS_PER_WORD * len(words))


def obs_id_to_words(obs_id: str, words: int = DEFAULT_WORDS) -> str:
    """Return the obs ID with its numeric tail replaced by dot-joined words."""
    prefix, _, tail = obs_id.rpartition("-")
    triple = ".".join(tail_to_words(int(tail), words))
    return f"{prefix}-{triple}"


def words_to_obs_id(spoken_id: str) -> str:
    """Inverse of obs_id_to_words: dotted-word tail back to the numeric obs ID."""
    prefix, _, triple = spoken_id.rpartition("-")
    tail = words_to_tail(triple.split("."))
    return f"{prefix}-{tail}"
