import sys
import logging
from typing import Optional
from videoscribe.domain.interfaces import AudioAnalyzer, SpeechRecognizer, ProgressReporter
from videoscribe.domain.models import TranscriptionSegment, Word
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

    def run(self, audio_path: str, model_size: str, device: str, compute_type: str, language: str, cancel_token: Optional[CancellationToken] = None) -> None:
        try:
            self._reporter.report_progress("loading_model", 0)
            self._recognizer.load_model(model_size, device, compute_type)
            
            # Step 1: Get duration for progress tracking
            duration = self._analyzer.get_duration(audio_path)
            if duration > 0:
                logger.info(f"Total duration: {duration}s")
            
            self._reporter.report_progress("transcribing", 0)
            
            # Step 2: Transcribe the whole file, yielding segments
            segments_iter, info = self._recognizer.transcribe_file(audio_path, language, cancel_token)
            
            if info:
                self._reporter.report_language(info.language)
                
            # Step 3: Iterate and report segments
            for segment in segments_iter:
                words = []
                if segment.words:
                    for w in segment.words:
                        words.append(Word(text=w.word, start=w.start, end=w.end, probability=w.probability))
                        
                start_time = segment.words[0].start if segment.words else segment.start
                end_time = segment.end
                
                domain_segment = TranscriptionSegment(
                    start=start_time,
                    end=end_time,
                    text=segment.text.strip(),
                    words=words
                )
                
                self._reporter.report_result(domain_segment)
                
                # Update progress based on segment time vs total duration
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
            # Do not exit here, let the worker handle it or continue listening

