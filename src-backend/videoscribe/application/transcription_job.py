import sys
import logging
from typing import Optional
from videoscribe.domain.interfaces import AudioAnalyzer, SpeechRecognizer, ProgressReporter
from videoscribe.domain.transcription_options import TranscriptionOptions
from videoscribe.application.segment_refiner import SegmentRefiner
from videoscribe.domain.cancellation import CancellationToken, CancelledException
from videoscribe.infrastructure.audio.mss_factory import MSSFactory
from videoscribe.domain.transcription_options import MSSEngineType

logger = logging.getLogger(__name__)

class TranscriptionJob:
    def __init__(
        self,
        analyzer: AudioAnalyzer,
        recognizer: SpeechRecognizer,
        reporter: ProgressReporter
    ):
        self._analyzer = analyzer
        self._recognizer = recognizer
        self._reporter = reporter

    def run(self, audio_path: str, options: TranscriptionOptions, cancel_token: Optional[CancellationToken] = None) -> None:
        try:
            self._reporter.report_progress("loading_model", 0)
            self._recognizer.load_model(options)
            
            # Step 1: Get duration for progress tracking
            duration = self._analyzer.get_duration(audio_path)
            if duration > 0:
                logger.info(f"Total duration: {duration}s")

            # Step 1.5: MSS (Music Source Separation) Pre-processing
            processed_audio_path = audio_path
            if options.mss_engine != MSSEngineType.OFF:
                mss_engine = MSSFactory.create(options)
                if mss_engine:
                    logger.info("Starting MSS preprocessing...")
                    # Update progress state specifically for MSS if desired, or keep as transcribing
                    self._reporter.report_progress("separating_audio", 0)
                    processed_audio_path = mss_engine.separate(audio_path, options)
                    logger.info(f"MSS preprocessing completed. Using audio: {processed_audio_path}")
            
            self._reporter.report_progress("transcribing", 0)
            
            # Step 2: Transcribe the file, yielding segments (use processed_audio_path)
            segments_iter, info = self._recognizer.transcribe_file(
                processed_audio_path, 
                options, 
                cancel_token
            )
            
            if info:
                self._reporter.report_language(info.language)
                
            # Step 3: Iterate and report segments uniformly via SegmentRefiner
            refiner = SegmentRefiner(options.cue_policy)
            
            for segment in segments_iter:
                refined_segments = refiner.process(segment)
                for domain_segment in refined_segments:
                    self._reporter.report_result(domain_segment)
                    
                # Update progress based on the original segment's end time
                if duration > 0:
                    progress_pct = min(100, int((segment.end / duration) * 100))
                    self._reporter.report_progress("transcribing", progress_pct)
            
            self._reporter.report_progress("completed", 100)
            
        except CancelledException as e:
            logger.info("Job was cancelled.")
            self._reporter.report_progress("cancelled", 0)
        except Exception as e:
            logger.exception("Transcription failed")
            self._reporter.report_error(f"Transcription failed: {str(e)}")

