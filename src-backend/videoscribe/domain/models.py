import numpy as np
from dataclasses import dataclass, field
from typing import List

@dataclass
class Word:
    text: str
    start: float
    end: float
    probability: float

@dataclass
class TranscriptionSegment:
    start: float
    end: float
    text: str
    words: List[Word] = field(default_factory=list)

@dataclass
class TranscriptionInfo:
    language: str
    language_probability: float
    duration: float

@dataclass
class AudioWindow:
    audio: np.ndarray
    start_time: float
    end_time: float
    is_last: bool
