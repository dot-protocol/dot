# SPDX-License-Identifier: Apache-2.0
"""dot-words — sovereign, reversible BIP39 geocoding + Oracle obs-id aliasing."""

from .geo import coordinates_to_dotwords, dotwords_to_coordinates
from .obs import (
    obs_id_to_words,
    words_to_obs_id,
    tail_to_words,
    words_to_tail,
)
from .codec import int_to_words, words_to_int

__version__ = "0.1.0"
__all__ = [
    "coordinates_to_dotwords",
    "dotwords_to_coordinates",
    "obs_id_to_words",
    "words_to_obs_id",
    "tail_to_words",
    "words_to_tail",
    "int_to_words",
    "words_to_int",
]
