from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class VADEngineType(Enum):
    OFF = "off"
    NATIVE = "native" # e.g. FasterWhisper's built-in VAD
    CUSTOM = "custom" # e.g. Silero VAD or other external chunking


@dataclass
class CuePolicy:
    """Policy for splitting words into transcription cues/segments."""
    max_word_gap_seconds: float = 0.5
    punctuation_chars: tuple[str, ...] = ('.', '?', '!', '。', '？', '！', '、', ',', '，')

@dataclass
class TranscriptionOptions:
    """Configuration options for the STT engine and workflow."""
    model_size: str
    device: str
    compute_type: str
    language: str = "auto"
    use_batch: bool = False
    batch_size: int = 16
    vad_engine: VADEngineType = VADEngineType.OFF
    initial_prompt: Optional[str] = None
    cue_policy: CuePolicy = field(default_factory=CuePolicy)

    def __post_init__(self):
        if self.use_batch and self.vad_engine == VADEngineType.OFF:
            self.vad_engine = VADEngineType.NATIVE
