from typing import Optional
from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType
from .pipeline_analyzer import VADPipelineAnalyzer
from videoscribe.infrastructure.audio.vad.silero_v6_analyzer import SileroEngine
from videoscribe.infrastructure.audio.vad.firered_analyzer import FireRedEngine

import logging

logger = logging.getLogger(__name__)

class VADFactory:
    """
    Factory for creating VAD analyzers based on the selected VADEngineType.
    Returns a VADPipelineAnalyzer which orchestrates the underlying engine.
    """
    @classmethod
    def create(cls, options: TranscriptionOptions) -> Optional[VADAnalyzer]:
        if options.vad_engine == VADEngineType.SILERO_V6:
            engine = SileroEngine()
            return VADPipelineAnalyzer(engine)
        elif options.vad_engine == VADEngineType.FIRERED_VAD:
            engine = FireRedEngine()
            return VADPipelineAnalyzer(engine)
            
        return None
