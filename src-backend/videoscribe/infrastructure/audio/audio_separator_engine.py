import os
import logging
from typing import Optional
from audio_separator.separator import Separator
from videoscribe.domain.interfaces import MSSAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions
from videoscribe.infrastructure.utils import get_tmp_dir

class AudioSeparatorEngine(MSSAnalyzer):
    """
    Music Source Separation Engine based on audio-separator.
    Separates vocals from instrumentals and returns the path to the vocals file.
    """
    def __init__(self, output_dir: Optional[str] = None, output_format: str = "wav"):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.output_format = output_format.lower()
        self.output_dir = output_dir

    def separate(self, audio_path: str, options: TranscriptionOptions) -> str:
        """
        Loads the model specified in options and separates vocals.
        Returns the path to the separated vocals audio file.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Input audio file not found: {audio_path}")

        # Use the centralized temporary directory for processing
        actual_output_dir = self.output_dir or get_tmp_dir()
        os.makedirs(actual_output_dir, exist_ok=True)

        self.logger.info(f"Initializing AudioSeparator in {actual_output_dir}...")
        separator = Separator(
            output_dir=actual_output_dir,
            output_format=self.output_format,
            log_level=logging.WARNING
        )

        model_filename = options.mss_model
        self.logger.info(f"Loading MSS model: {model_filename}")
        try:
            separator.load_model(model_filename=model_filename)
        except Exception as e:
            self.logger.error(f"Failed to load MSS model '{model_filename}': {e}")
            raise RuntimeError(f"Failed to load MSS model '{model_filename}': {e}") from e

        self.logger.info(f"Starting audio separation for: {audio_path}")
        try:
            # audio-separator typically returns a list of output filenames.
            # Depending on the model, it might return [vocals_path, instrumental_path]
            output_files = separator.separate(audio_path)
            
            # Identify the vocals file. By default convention, it often contains 'Vocals' or 'vocals'.
            # We'll return the first file that looks like a vocal track, or the first file as fallback.
            vocals_file = None
            for f in output_files:
                if 'vocals' in f.lower() or 'vocal' in f.lower():
                    vocals_file = f
                    break
            
            if not vocals_file and output_files:
                vocals_file = output_files[0]
                
            if not vocals_file:
                raise RuntimeError("No output files generated from separation.")

            result_path = os.path.join(actual_output_dir, vocals_file)
            self.logger.info(f"Separation complete. Vocals path: {result_path}")
            
            return result_path
            
        except Exception as e:
            self.logger.error(f"Audio separation failed: {e}")
            raise RuntimeError(f"Audio separation failed: {e}") from e
