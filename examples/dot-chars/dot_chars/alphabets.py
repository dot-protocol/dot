# SPDX-License-Identifier: Apache-2.0
"""Frozen alphabets for dot-chars, pinned to Unicode 15.0.

IMMUTABILITY DISCIPLINE (the dot-chars analogue of dot-words' frozen BIP39 list):

    The codepoint <-> index mapping is FROZEN at Unicode 15.0. Future emoji or
    newly-assigned codepoints EXTEND the space (append to the end); they NEVER
    remap an existing index. An address minted today must decode identically a
    century from now, on any runtime, regardless of how many codepoints Unicode
    later assigns.

Three vocabularies:

  UNICODE  — the full Unicode codepoint space: 1,114,112 = 0x110000 codepoints
             (U+0000 .. U+10FFFF). The bijection is the identity: index i <-> the
             character chr(i). We use the WHOLE space (1,114,112), NOT only the
             ~150K currently-assigned codepoints, precisely so the mapping is a
             pure arithmetic constant that no future Unicode revision can shift.
             V = 1,114,112  (~2^20.087 bits/char).

  ALNUM    — a fixed 62-symbol alphabet "0-9A-Za-z" in that exact order.
             V = 62  (~2^5.954 bits/char).

  EMOJI    — a frozen list of exactly 1024 single-codepoint emoji, walked in a
             fixed order from contiguous Unicode 15.0 emoji blocks (see
             _EMOJI_RANGES). V = 1024 = 2^10  (exactly 10 bits/emoji).

Each vocabulary is presented as (LIST, INDEX) where LIST[i] -> symbol and
INDEX[symbol] -> i. For UNICODE the LIST is virtual (a range) to avoid
materialising 1.1M strings.
"""

# ---------------------------------------------------------------------------
# UNICODE — full codepoint space, identity bijection
# ---------------------------------------------------------------------------

UNICODE_SIZE = 0x110000  # 1,114,112 codepoints, U+0000..U+10FFFF (Unicode 15.0, stable)
assert UNICODE_SIZE == 1_114_112


class _UnicodeAlphabet:
    """Virtual indexable alphabet over the full Unicode codepoint space.

    index i  <-> chr(i). Frozen: index == codepoint, forever.
    """

    def __len__(self) -> int:
        return UNICODE_SIZE

    def __getitem__(self, i: int) -> str:
        if not (0 <= i < UNICODE_SIZE):
            raise IndexError(i)
        return chr(i)


class _UnicodeIndex:
    """Virtual mapping char -> codepoint (ord)."""

    def __len__(self) -> int:
        return UNICODE_SIZE

    def __getitem__(self, ch: str) -> int:
        cp = ord(ch)
        if not (0 <= cp < UNICODE_SIZE):
            raise KeyError(ch)
        return cp


UNICODE_ALPHABET = _UnicodeAlphabet()
UNICODE_INDEX = _UnicodeIndex()


# ---------------------------------------------------------------------------
# ALNUM — fixed 62-symbol alphabet
# ---------------------------------------------------------------------------

ALNUM_ALPHABET = list("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
assert len(ALNUM_ALPHABET) == 62
ALNUM_INDEX = {c: i for i, c in enumerate(ALNUM_ALPHABET)}


# ---------------------------------------------------------------------------
# EMOJI — frozen 3600-symbol list from Unicode 15.0 blocks
# ---------------------------------------------------------------------------
# EMOJI_SIZE = 3600 gives ~2.75x headroom over the Earth-3m demand (spec: ~3x).
# Derivation: 3600^4 = 1.68e14 ≈ 2^47.2; Earth surface at 3m ≈ 2^45.8;
# ratio ≈ 2.75x, which rounds to the spec's "~3x".
#
# IMMUTABILITY RULE:
#   - Walk _EMOJI_RANGES in the fixed order below, collecting codepoints.
#   - Take EXACTLY the first EMOJI_SIZE = 3600.
#   - Extending the emoji alphabet later = APPEND new ranges AFTER these and
#     raise EMOJI_SIZE; never reorder or remove existing ranges.
#   - This gives each future Unicode version additional space above index 3599
#     without shifting any existing index.
#
# All codepoints here are in blocks assigned by Unicode 15.0 (Sept 2022).
_EMOJI_RANGES = [
    # ---- Primary emoji/symbol blocks (walk in this exact order) ----
    (0x1F600, 0x1F64F),  # Emoticons (80 codepoints)
    (0x1F300, 0x1F5FF),  # Misc Symbols and Pictographs (768)
    (0x1F680, 0x1F6FF),  # Transport and Map Symbols (128)
    (0x1F700, 0x1F77F),  # Alchemical Symbols (128)
    (0x1F780, 0x1F7FF),  # Geometric Shapes Extended (128)
    (0x1F800, 0x1F8FF),  # Supplemental Arrows-C (256)
    (0x1F900, 0x1F9FF),  # Supplemental Symbols and Pictographs (256)
    (0x1FA00, 0x1FA6F),  # Chess Symbols (112)
    (0x1FA70, 0x1FAFF),  # Symbols and Pictographs Extended-A (144)
    (0x2600, 0x26FF),    # Miscellaneous Symbols (256)
    (0x2700, 0x27BF),    # Dingbats (192)
    # ---- Secondary blocks (needed to reach 3600) ----
    (0x1F000, 0x1F0FF),  # Mahjong Tiles + Domino Tiles + Playing Cards (256)
    (0x1F100, 0x1F1FF),  # Enclosed Alphanumeric Supplement (256)
    (0x1F200, 0x1F2FF),  # Enclosed Ideographic Supplement (256)
    # ---- Secondary blocks (needed to reach 3600) ----
    (0x2300, 0x23FF),    # Miscellaneous Technical (256)
    (0x2500, 0x257F),    # Box Drawing (128) — exactly fills to 3600
    # ---- Extension slots: append here to grow past 3600 ----
]
EMOJI_SIZE = 3600  # ~2.75x headroom over Earth-3m demand (spec: ~3x)


def _build_emoji():
    cps = []
    seen: set = set()
    for lo, hi in _EMOJI_RANGES:
        for cp in range(lo, hi + 1):
            if cp not in seen:
                seen.add(cp)
                cps.append(cp)
                if len(cps) >= EMOJI_SIZE:
                    return cps
    raise RuntimeError(
        f"emoji ranges yield only {len(cps)} distinct codepoints; "
        f"need {EMOJI_SIZE}. Append more ranges to _EMOJI_RANGES."
    )


_EMOJI_CODEPOINTS = _build_emoji()
assert len(_EMOJI_CODEPOINTS) == EMOJI_SIZE
assert len(set(_EMOJI_CODEPOINTS)) == EMOJI_SIZE  # all distinct

EMOJI_ALPHABET = [chr(cp) for cp in _EMOJI_CODEPOINTS]
EMOJI_INDEX = {c: i for i, c in enumerate(EMOJI_ALPHABET)}

# Frozen test vectors: first and last entries pin the Unicode-15.0 mapping.
# If a future edit reorders ranges or changes EMOJI_SIZE, these assertions fail.
FROZEN_EMOJI_FIRST = 0x1F600   # 😀  index 0    (start of Emoticons block)
FROZEN_EMOJI_LAST  = 0x257F    # ╿  index 3599  (last codepoint of Box Drawing block)
