import logging
from typing import Optional
from videoscribe.domain.interfaces import MSSAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions, MSSEngineType
from videoscribe.infrastructure.audio.audio_separator_engine import AudioSeparatorEngine

logger = logging.getLogger(__name__)

class MSSFactory:
    """
    Factory for creating the appropriate MSS analyzer based on options.
    """
    @staticmethod
    def create(options: TranscriptionOptions) -> Optional[MSSAnalyzer]:
        if options.mss_engine == MSSEngineType.OFF:
            return None
            
        if options.mss_engine == MSSEngineType.AUDIO_SEPARATOR:
            logger.info("Instantiating AudioSeparatorEngine for MSS")
            return AudioSeparatorEngine()
            
        logger.warning(f"Unknown MSS engine requested: {options.mss_engine}. Falling back to no MSS.")
        return None
