import logging
from typing import Optional, Callable
from videoscribe.domain.interfaces import VADAnalyzer, IVADEngine
from videoscribe.domain.models import VADResult
from videoscribe.domain.transcription_options import TranscriptionOptions
from .pipeline import VADPipeline, SmartMergeProcessor, MinCutProcessor

logger = logging.getLogger(__name__)

class VADPipelineAnalyzer(VADAnalyzer):
    """
    Facade that implements VADAnalyzer interface.
    Orchestrates the selected IVADEngine and the VAD processing pipeline.
    """
    def __init__(self, engine: IVADEngine):
        self.engine = engine
        # Hardcoded to optimal 30s chunks for Whisper
        self.pipeline = VADPipeline(processors=[
            SmartMergeProcessor(max_chunk_sec=30.0, max_gap_sec=1.0),
            MinCutProcessor(max_chunk_sec=30.0, pad_sec=0.0)
        ])

    def analyze(self, audio_path: str, options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> Optional[VADResult]:
        def report(pct: float):
            if progress_callback:
                progress_callback(pct)

        try:
            report(10.0)
            logger.info("VADPipelineAnalyzer: Starting engine prediction...")
            
            # Step 1: Engine extracts native segments + probabilities
            context = self.engine.predict(audio_path, options)
            report(60.0)
            
            logger.info("VADPipelineAnalyzer: Running VAD Pipeline (SmartMerge -> MinCut)...")
            # Step 2: Pipeline processes context (merge + min-cut)
            final_context = self.pipeline.run(context)
            report(95.0)
            
            # Step 3: Map to final VADResult format
            result = VADResult(segments=final_context.segments)
            logger.info(f"VADPipelineAnalyzer: Finished. Produced {len(result.segments)} perfect chunks.")
            report(100.0)
            return result
            
        except Exception as e:
            logger.error(f"VADPipelineAnalyzer failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return None
