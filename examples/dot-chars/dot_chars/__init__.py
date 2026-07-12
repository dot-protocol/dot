# SPDX-License-Identifier: Apache-2.0
"""dot-chars — sovereign, reversible character-based location addressing.

The character-based sibling of dot-words: smaller atoms (Unicode characters,
alphanumerics, or emoji) instead of BIP39 words, same reversible
quantise -> scramble -> encode pipeline, same WGS84 axis ranges.
"""

from .geo import (
    unicode_to_dotchars,
    dotchars_to_unicode,
    alphanumeric_to_dotchars,
    dotchars_to_alphanumeric,
    emoji_to_dotchars,
    dotchars_to_emoji,
    RESOLUTION,
)

__version__ = "0.1.0"
__all__ = [
    "unicode_to_dotchars",
    "dotchars_to_unicode",
    "alphanumeric_to_dotchars",
    "dotchars_to_alphanumeric",
    "emoji_to_dotchars",
    "dotchars_to_emoji",
    "RESOLUTION",
]
