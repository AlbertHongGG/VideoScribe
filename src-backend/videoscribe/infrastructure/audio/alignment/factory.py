import logging
from typing import Optional
from videoscribe.domain.interfaces import ForcedAlignmentAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions, ForcedAlignmentEngineType
from videoscribe.infrastructure.audio.alignment.ctc_aligner_engine import CTCAlignerEngine

logger = logging.getLogger(__name__)

class ForcedAlignmentFactory:
    """
    Factory for creating the appropriate Forced Alignment analyzer based on options.
    """
    @staticmethod
    def create(options: TranscriptionOptions) -> Optional[ForcedAlignmentAnalyzer]:
        if options.fa_engine == ForcedAlignmentEngineType.OFF:
            return None
            
        if options.fa_engine == ForcedAlignmentEngineType.CTC_FORCED_ALIGNER:
            logger.info("Instantiating CTCAlignerEngine for Forced Alignment")
            return CTCAlignerEngine()
            
        logger.warning(f"Unknown Forced Alignment engine requested: {options.fa_engine}. Falling back to no FA.")
        return None
