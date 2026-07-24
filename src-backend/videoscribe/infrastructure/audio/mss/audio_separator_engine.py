import os
import logging
from typing import Optional, Callable
from audio_separator.separator import Separator
from videoscribe.domain.interfaces import MSSAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions
from videoscribe.infrastructure.utils import get_tmp_dir

from videoscribe.domain.models import MSSResult

class AudioSeparatorEngine(MSSAnalyzer):
    """
    Music Source Separation Engine based on audio-separator.
    Separates vocals from instrumentals and returns MSSResult containing both audio files.
    """
    def __init__(self, output_dir: Optional[str] = None, output_format: str = "wav"):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.output_format = output_format.lower()
        self.output_dir = output_dir

    def separate(self, audio_path: str, options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> MSSResult:
        def report(pct: float):
            if progress_callback:
                progress_callback(pct)

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Input audio file not found: {audio_path}")

        report(5.0)
        # Use the centralized temporary directory for processing
        actual_output_dir = self.output_dir or get_tmp_dir()
        os.makedirs(actual_output_dir, exist_ok=True)

        self.logger.info(f"Initializing AudioSeparator in {actual_output_dir}...")
        separator = Separator(
            output_dir=actual_output_dir,
            output_format=self.output_format,
            log_level=logging.WARNING
        )
        report(10.0)

        model_filename = options.mss_model
        self.logger.info(f"Loading MSS model: {model_filename}")
        try:
            separator.load_model(model_filename=model_filename)
        except Exception as e:
            self.logger.error(f"Failed to load MSS model '{model_filename}': {e}")
            raise RuntimeError(f"Failed to load MSS model '{model_filename}': {e}") from e

        report(30.0)
        self.logger.info(f"Starting audio separation for: {audio_path}")
        try:
            # Note: This is a blocking call and might take several minutes.
            # We report 90% immediately after it finishes because the core inference is done.
            output_files = separator.separate(audio_path)
            report(90.0)
            
            vocals_file = None
            instrumental_file = None
            for f in output_files:
                f_lower = f.lower()
                if 'vocals' in f_lower or 'vocal' in f_lower:
                    vocals_file = f
                elif 'instrumental' in f_lower or 'background' in f_lower or 'other' in f_lower:
                    instrumental_file = f

            if not vocals_file and output_files:
                vocals_file = output_files[0]
                if len(output_files) > 1:
                    instrumental_file = output_files[1]

            if not vocals_file:
                raise RuntimeError("No output files generated from separation.")

            vocals_path = os.path.join(actual_output_dir, vocals_file)
            instrumental_path = os.path.join(actual_output_dir, instrumental_file) if instrumental_file else None
            
            self.logger.info(f"Separation complete. Vocals: {vocals_path}, Instrumental: {instrumental_path}")
            
            report(100.0)
            return MSSResult(vocals_path=vocals_path, instrumental_path=instrumental_path)
            
        except Exception as e:
            self.logger.error(f"Audio separation failed: {e}")
            raise RuntimeError(f"Audio separation failed: {e}") from e
