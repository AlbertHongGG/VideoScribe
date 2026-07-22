import logging
from typing import Iterator, Tuple, Optional, Any
from faster_whisper import WhisperModel, BatchedInferencePipeline
from faster_whisper.audio import decode_audio
from videoscribe.domain.models import AudioWindow, Word, TranscriptionInfo, VADResult
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
            "condition_on_previous_text": True,
            "vad_parameters": dict(min_silence_duration_ms=500, speech_pad_ms=400)
        }
        
        # Determine total audio duration for fallback / fixed chunking
        total_duration = 0.0
        try:
            audio_buf = decode_audio(audio_path, sampling_rate=16000)
            total_duration = len(audio_buf) / 16000.0
        except Exception as e:
            logger.warning(f"Could not calculate audio duration prior to transcription: {e}")

        # 1. Ask Factory for external VAD Analyzer
        external_vad = VADFactory.create(options)
        raw_vad_result = external_vad.analyze(audio_path, options) if external_vad else None

        # 2. Outer layer: VAD State / Inner layer: Batch State
        if raw_vad_result and not raw_vad_result.is_empty:
            # Outer: VAD ON
            vad_result = raw_vad_result.merge_and_pad(padding_sec=2.0, total_duration=total_duration)
            transcribe_kwargs["vad_filter"] = False

            if self._is_batched:
                # Inner: Batch ON -> Subdivide >30s segments for Batch requirements
                transcribe_kwargs["batch_size"] = options.batch_size
                batched_vad_result = vad_result.split_long_segments(max_chunk_sec=30.0)
                transcribe_kwargs["clip_timestamps"] = batched_vad_result.to_dict_list()
                logger.info(f"VAD ON with Batch ON: {len(batched_vad_result.windows)} chunks (<=30s each).")
            else:
                # Inner: Batch OFF -> NO 30s splitting! Natural VAD segments.
                transcribe_kwargs["clip_timestamps"] = vad_result.to_flat_list()
                logger.info(f"VAD ON with Batch OFF: {len(vad_result.windows)} natural VAD segments (no 30s splitting).")

        elif options.vad_engine == VADEngineType.NATIVE:
            # Outer: Native VAD
            transcribe_kwargs["vad_filter"] = True
            if self._is_batched:
                transcribe_kwargs["batch_size"] = options.batch_size
            logger.info("Using Native Whisper VAD filter.")

        else:
            # Outer: VAD OFF
            transcribe_kwargs["vad_filter"] = False

            if self._is_batched:
                # Inner: Batch ON -> Generate fixed 30s timestamp grid for Batch
                transcribe_kwargs["batch_size"] = options.batch_size
                fixed_chunks = VADResult.generate_fixed_chunks(total_duration, chunk_sec=30.0)
                transcribe_kwargs["clip_timestamps"] = fixed_chunks
                logger.info(f"VAD OFF with Batch ON: Generated {len(fixed_chunks)} fixed 30s chunks.")
            else:
                # Inner: Batch OFF -> NO VAD, NO 30s splitting, standard full-audio transcription
                logger.info("VAD OFF with Batch OFF: Standard full-audio transcription (no splitting).")

        if options.language != "auto" and options.language:
            transcribe_kwargs["language"] = options.language
            
        if self._is_batched:
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
