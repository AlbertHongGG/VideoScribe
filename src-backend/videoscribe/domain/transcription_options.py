from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class VADEngineType(Enum):
    OFF = "off"
    NATIVE = "native"
    SILERO = "silero"
    SILERO_V6 = "silero_v6"
    FIRERED_VAD = "firered_vad"

class MSSEngineType(Enum):
    OFF = "off"
    AUDIO_SEPARATOR = "audio_separator"

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
    mss_engine: MSSEngineType = MSSEngineType.OFF
    mss_model: str = "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt"
    initial_prompt: Optional[str] = None
    cue_policy: CuePolicy = field(default_factory=CuePolicy)

    def __post_init__(self):
        if self.use_batch and self.vad_engine == VADEngineType.OFF:
            self.vad_engine = VADEngineType.NATIVE
