import sys
import logging
from typing import Optional
from videoscribe.domain.interfaces import AudioAnalyzer, SpeechRecognizer, ProgressReporter
from videoscribe.domain.transcription_options import TranscriptionOptions
from videoscribe.application.transcript_assembler import TranscriptAssembler
from videoscribe.domain.cancellation import CancellationToken, CancelledException

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
            
            self._reporter.report_progress("transcribing", 0)
            
            # Step 2: Transcribe the whole file, yielding segments
            segments_iter, info = self._recognizer.transcribe_file(
                audio_path, 
                options, 
                cancel_token
            )
            
            if info:
                self._reporter.report_language(info.language)
                
            # Step 3: Iterate and report segments via Assembler
            assembler = TranscriptAssembler(options.cue_policy, self._reporter)
            
            for segment in segments_iter:
                assembler.process_segment(segment)
                
                # Update progress based on segment time vs total duration
                if duration > 0:
                    progress_pct = min(100, int((segment.end / duration) * 100))
                    self._reporter.report_progress("transcribing", progress_pct)
                    
            assembler.flush() # Ensure the last chunk is sent
            self._reporter.report_progress("completed", 100)
            
        except CancelledException as e:
            logger.info("Job was cancelled.")
            self._reporter.report_progress("cancelled", 0)
        except Exception as e:
            logger.exception("Transcription failed")
            self._reporter.report_error(f"Transcription failed: {str(e)}")

