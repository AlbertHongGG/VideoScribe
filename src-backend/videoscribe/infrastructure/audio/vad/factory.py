from typing import Optional
from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType

from .silero_v6_analyzer import SileroEngine
from .firered_analyzer import FireRedEngine
from .pipeline_analyzer import VADPipelineAnalyzer
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
