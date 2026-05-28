# SPDX-License-Identifier: Apache-2.0
"""BIP39 English wordlist loader. 2048 words = exactly 11 bits per word."""

from pathlib import Path

_PATH = Path(__file__).with_name("english.txt")

WORDS = _PATH.read_text(encoding="utf-8").split()
if len(WORDS) != 2048:
    raise RuntimeError(f"BIP39 wordlist must be 2048 words, got {len(WORDS)}")

WORD_INDEX = {w: i for i, w in enumerate(WORDS)}

BITS_PER_WORD = 11  # 2**11 == 2048
