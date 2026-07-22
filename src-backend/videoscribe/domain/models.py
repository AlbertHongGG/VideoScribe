import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional

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
    all_language_probs: Optional[list] = None

@dataclass
class AudioWindow:
    audio: np.ndarray
    start_time: float
    end_time: float
    is_last: bool

@dataclass
class VADResult:
    """
    Rich domain model representing the result of VAD analysis.
    Regulates the output format for various consumers.
    """
    windows: list[AudioWindow]

    @property
    def is_empty(self) -> bool:
        return len(self.windows) == 0

    def to_dict_list(self) -> list[dict]:
        """Returns format required by Batched Inference (list of dicts)."""
        return [{"start": w.start_time, "end": w.end_time} for w in self.windows]

    def to_flat_list(self) -> list[float]:
        """Returns format required by Standard Inference (flat list of floats)."""
        flat_list = []
        for w in self.windows:
            flat_list.extend([w.start_time, w.end_time])
        return flat_list

@dataclass
class MSSResult:
    """
    Domain model representing separated audio stems.
    """
    vocals_path: str
    instrumental_path: Optional[str] = None