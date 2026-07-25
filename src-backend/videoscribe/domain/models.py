import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum

class TaskType(str, Enum):
    MSS = "mss"
    VAD = "vad"
    STT = "stt"
    FORCED_ALIGNMENT = "forced_alignment"
    TRANSLATION = "translation"

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"

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
class SpeechSegment:
    start_time: float
    end_time: float

@dataclass
class VADContext:
    """
    Context passing through the VAD pipeline.
    """
    segments: list[SpeechSegment] = field(default_factory=list)
    frame_probabilities: Optional[np.ndarray] = None
    sample_rate: int = 16000
    audio_duration: float = 0.0

@dataclass
class VADResult:
    """
    Rich domain model representing the final output of the VAD pipeline.
    """
    segments: list[SpeechSegment]

    @property
    def is_empty(self) -> bool:
        return len(self.segments) == 0

    def to_dict_list(self) -> list[dict]:
        """Returns format required by Batched Inference (list of dicts)."""
        return [{"start": w.start_time, "end": w.end_time} for w in self.segments]

    def to_flat_list(self) -> list[float]:
        """Returns format required by Standard Inference (flat list of floats)."""
        flat_list = []
        for w in self.segments:
            flat_list.extend([w.start_time, w.end_time])
        return flat_list

@dataclass
class MSSResult:
    """
    Domain model representing separated audio stems.
    """
    vocals_path: str
    instrumental_path: Optional[str] = None