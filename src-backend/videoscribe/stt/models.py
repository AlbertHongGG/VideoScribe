from dataclasses import dataclass
from typing import List, Optional

@dataclass
class STTResult:
    start: float
    end: float
    text: str

@dataclass
class TranscriptionInfo:
    language: str
    language_probability: float
    duration: float

