import logging
from pathlib import Path
from typing import Any, List, Optional, Callable
import numpy as np
import torch

try:
    from fireredvad import FireRedVad, FireRedVadConfig
    HAS_FIREREDVAD = True
except ImportError:
    HAS_FIREREDVAD = False

try:
    from huggingface_hub import snapshot_download
    HAS_HF_HUB = True
except ImportError:
    HAS_HF_HUB = False

try:
    from faster_whisper.audio import decode_audio
    HAS_DECODE_AUDIO = True
except ImportError:
    HAS_DECODE_AUDIO = False

try:
    import torchaudio
    HAS_TORCHAUDIO = True
except ImportError:
    HAS_TORCHAUDIO = False

from videoscribe.domain.interfaces import IVADEngine
from videoscribe.domain.models import VADContext, SpeechSegment
from videoscribe.domain.transcription_options import TranscriptionOptions

logger = logging.getLogger(__name__)


class FireRedEngine(IVADEngine):
    """
    Voice Activity Detection Engine powered by FireRedVAD (XiaoHongShu Industrial VAD).
    Supports GPU PyTorch execution with automatic CPU fallback.
    Implements the IVADEngine domain interface.
    """

    def __init__(self, custom_model_dir: Optional[str] = None) -> None:
        self.custom_model_dir = custom_model_dir
        self._model: Optional[Any] = None
        self._model_dir: Optional[Path] = None

    def _resolve_model_dir(self) -> Path:
        if self._model_dir and self._model_dir.exists():
            return self._model_dir

        if self.custom_model_dir:
            p = Path(self.custom_model_dir)
            if p.is_dir():
                self._model_dir = p
                return p
            raise FileNotFoundError(f"FireRedVAD custom model directory not found: {self.custom_model_dir}")

        if not HAS_HF_HUB:
            raise RuntimeError("huggingface_hub is not installed. Unable to download FireRedVAD pretrained model.")

        logger.info("FireRedEngine: Resolving pretrained model from Hugging Face (FireRedTeam/FireRedVAD)...")
        repo_root = Path(snapshot_download("FireRedTeam/FireRedVAD"))
        vad_dir = repo_root / "VAD"
        if not vad_dir.exists():
            raise FileNotFoundError(f"VAD subdirectory not found in downloaded repo: {vad_dir}")

        self._model_dir = vad_dir
        return vad_dir

    def _init_model(self, use_gpu: bool) -> Any:
        if not HAS_FIREREDVAD:
            raise ImportError("fireredvad package is not installed.")

        vad_dir = self._resolve_model_dir()
        config = FireRedVadConfig(
            use_gpu=use_gpu,
            speech_threshold=0.3,
            min_speech_frame=3,
            # We don't limit max_speech_frame here so the pipeline can min-cut it cleanly!
            max_speech_frame=1000000, 
            min_silence_frame=15,
        )
        return FireRedVad.from_pretrained(str(vad_dir), config=config)

    def predict(self, audio_path: str, options: TranscriptionOptions) -> VADContext:
        if not HAS_FIREREDVAD:
            raise RuntimeError("fireredvad package is not installed.")

        logger.info(f"FireRedEngine: Running FireRedVAD on {audio_path}")

        # Decode audio to 16kHz mono int16 PCM array
        if HAS_DECODE_AUDIO:
            audio_float = decode_audio(audio_path, sampling_rate=16000)
            pcm_int16 = (np.clip(audio_float, -1.0, 1.0) * 32767.0).astype(np.int16)
        elif HAS_TORCHAUDIO:
            waveform, sample_rate = torchaudio.load(audio_path)
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
                waveform = resampler(waveform)
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            audio_float = waveform.squeeze().numpy()
            pcm_int16 = (np.clip(audio_float, -1.0, 1.0) * 32767.0).astype(np.int16)
        else:
            raise RuntimeError("Neither faster_whisper.audio nor torchaudio is available.")

        audio_duration = len(pcm_int16) / 16000.0

        want_gpu = torch.cuda.is_available()
        model = None

        if want_gpu:
            try:
                model = self._init_model(use_gpu=True)
            except Exception as exc:
                logger.warning(f"FireRedEngine: GPU initialization failed ({exc}). Falling back to CPU...")

        if model is None:
            model = self._init_model(use_gpu=False)

        # Detect speech segments and probabilities simultaneously
        raw_result, probs_tensor = model.detect(pcm_int16, do_postprocess=True)
        timestamps: List[Any] = raw_result.get("timestamps", [])
        
        probs = probs_tensor.squeeze().cpu().numpy() if probs_tensor is not None else None

        segments = []
        for i, item in enumerate(timestamps):
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                start_sec = float(item[0])
                end_sec = float(item[1])
                segments.append(SpeechSegment(start_time=start_sec, end_time=end_sec))

        logger.info(f"FireRedEngine: Generated {len(segments)} native speech chunks.")
        
        return VADContext(
            segments=segments,
            frame_probabilities=probs,
            sample_rate=16000,
            audio_duration=audio_duration
        )
