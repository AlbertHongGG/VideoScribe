from typing import Optional
from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType
from .native_analyzer import NativeVADAnalyzer
from .custom_analyzer import CustomVADAnalyzer

class VADFactory:
    """
    Factory for creating VAD analyzers based on the transcription options.
    """
    
    @staticmethod
    def create(options: TranscriptionOptions) -> Optional[VADAnalyzer]:
        if options.vad_engine == VADEngineType.OFF:
            return None
        elif options.vad_engine == VADEngineType.NATIVE:
            return NativeVADAnalyzer()
        elif options.vad_engine == VADEngineType.CUSTOM:
            return CustomVADAnalyzer()
        else:
            raise ValueError(f"Unknown VAD engine type: {options.vad_engine}")
