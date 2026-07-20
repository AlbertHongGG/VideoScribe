import logging
from typing import Iterator, Tuple, Optional, Any
from faster_whisper import WhisperModel
from videoscribe.domain.models import AudioWindow, Word, TranscriptionInfo
from videoscribe.domain.interfaces import SpeechRecognizer
from videoscribe.domain.cancellation import CancellationToken, CancelledException

logger = logging.getLogger(__name__)

class FasterWhisperEngine(SpeechRecognizer):
    def __init__(self):
        self._model = None
        
    def load_model(self, model_size: str, device: str, compute_type: str) -> None:
        logger.info(f"Loading WhisperModel: {model_size} on {device} ({compute_type})")
        self._model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
    def transcribe_file(self, audio_path: str, language: str = "auto", cancel_token: Optional[CancellationToken] = None) -> Tuple[Iterator[Any], Optional[TranscriptionInfo]]:
        if not self._model:
            raise RuntimeError("Model not loaded. Call load_model first.")
            
        transcribe_kwargs = {
            "beam_size": 5,
            "vad_filter": False,
            "word_timestamps": True,
            "condition_on_previous_text": False
        }
        
        if language != "auto" and language:
            transcribe_kwargs["language"] = language
            
        segments, info = self._model.transcribe(audio_path, **transcribe_kwargs)
        
        domain_info = TranscriptionInfo(
            language=info.language,
            language_probability=info.language_probability,
            duration=info.duration
        )
        
        def segment_generator():
            for segment in segments:
                if cancel_token and cancel_token.is_cancelled:
                    logger.info("Transcription cancelled by token.")
                    raise CancelledException("Transcription cancelled by user")
                yield segment
                
        return segment_generator(), domain_info
