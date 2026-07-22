from typing import Optional
from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType

from .silero_v6_analyzer import SileroVADv6Analyzer
from .firered_analyzer import FireRedVADAnalyzer
import logging

logger = logging.getLogger(__name__)

class VADFactory:
    """
    Factory for creating VAD analyzers based on the selected VADEngineType.
    """
    @classmethod
    def create(cls, options: TranscriptionOptions) -> Optional[VADAnalyzer]:
        if options.vad_engine == VADEngineType.SILERO_V6:
            return SileroVADv6Analyzer()
        elif options.vad_engine == VADEngineType.FIRERED_VAD:
            return FireRedVADAnalyzer()
            
        return None
