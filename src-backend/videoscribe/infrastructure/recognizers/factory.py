from typing import Optional
from videoscribe.domain.interfaces import SpeechRecognizer
from videoscribe.domain.transcription_options import TranscriptionOptions, STTEngineType

class STTFactory:
    """
    Factory for creating SpeechRecognizer instances based on STTEngineType.
    """
    @classmethod
    def create(cls, options: TranscriptionOptions) -> Optional[SpeechRecognizer]:
        if options.stt_engine == STTEngineType.FASTER_WHISPER:
            from videoscribe.infrastructure.recognizers.faster_whisper_engine import FasterWhisperEngine
            return FasterWhisperEngine()
        return None
