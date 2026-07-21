import logging
from typing import Iterator, Tuple, Optional, Any
from faster_whisper import WhisperModel, BatchedInferencePipeline
from videoscribe.domain.models import AudioWindow, Word, TranscriptionInfo
from videoscribe.domain.interfaces import SpeechRecognizer
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType
from videoscribe.domain.cancellation import CancellationToken, CancelledException
from videoscribe.infrastructure.audio.vad.factory import VADFactory

logger = logging.getLogger(__name__)

class FasterWhisperEngine(SpeechRecognizer):
    def __init__(self):
        self._model = None
        self._pipeline = None
        self._is_batched = False
        
    def load_model(self, options: TranscriptionOptions) -> None:
        logger.info(f"Loading WhisperModel: {options.model_size} on {options.device} ({options.compute_type})")
        self._model = WhisperModel(options.model_size, device=options.device, compute_type=options.compute_type)
        
        if options.use_batch:
            logger.info(f"Initializing BatchedInferencePipeline with batch_size={options.batch_size}.")
            self._pipeline = BatchedInferencePipeline(model=self._model)
            self._is_batched = True
        else:
            logger.info("Using standard inference.")
            self._is_batched = False
            self._pipeline = None
            
    def transcribe_file(self, audio_path: str, options: TranscriptionOptions, cancel_token: Optional[CancellationToken] = None) -> Tuple[Iterator[Any], Optional[TranscriptionInfo]]:
        if not self._model:
            raise RuntimeError("Model not loaded. Call load_model first.")
            
        transcribe_kwargs = {
            "beam_size": 5,
            "word_timestamps": True,
            "condition_on_previous_text": False
        }
        
        # Configure VAD based on engine type
        custom_vad_windows = None
        if options.vad_engine == VADEngineType.CUSTOM:
            vad_analyzer = VADFactory.create(options)
            if vad_analyzer:
                logger.info(f"Running Custom VAD Analyzer internally: {vad_analyzer.__class__.__name__}")
                windows_iter = vad_analyzer.analyze(audio_path, options)
                if windows_iter is not None:
                    custom_vad_windows = list(windows_iter)
                    logger.info(f"Custom VAD generated {len(custom_vad_windows)} chunks.")
        
        if options.vad_engine == VADEngineType.CUSTOM and custom_vad_windows is not None:
            transcribe_kwargs["vad_filter"] = False
            if self._is_batched:
                transcribe_kwargs["clip_timestamps"] = [{"start": w.start, "end": w.end} for w in custom_vad_windows]
            else:
                # Flat list of start/end pairs for standard model
                flat_list = []
                for w in custom_vad_windows:
                    flat_list.extend([w.start, w.end])
                transcribe_kwargs["clip_timestamps"] = flat_list
        else:
            transcribe_kwargs["vad_filter"] = (options.vad_engine == VADEngineType.NATIVE)
        
        if options.language != "auto" and options.language:
            transcribe_kwargs["language"] = options.language
            
        if options.initial_prompt:
            transcribe_kwargs["initial_prompt"] = options.initial_prompt
            
        if self._is_batched:
            transcribe_kwargs["batch_size"] = options.batch_size
            logger.info(f"Starting batched transcription with kwargs: {transcribe_kwargs}")
            segments, info = self._pipeline.transcribe(audio_path, **transcribe_kwargs)
        else:
            logger.info(f"Starting standard transcription with kwargs: {transcribe_kwargs}")
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
