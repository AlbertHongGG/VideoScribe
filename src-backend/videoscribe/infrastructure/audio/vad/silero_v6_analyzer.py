import logging
from typing import Any, Callable, List, Optional
import numpy as np
import torch

try:
    import torchaudio
    HAS_TORCHAUDIO = True
except ImportError:
    HAS_TORCHAUDIO = False

try:
    from silero_vad import get_speech_timestamps as silero_pkg_get_speech_ts, load_silero_vad as silero_pkg_load
    HAS_SILERO_VAD_PKG = True
except ImportError:
    HAS_SILERO_VAD_PKG = False

from videoscribe.domain.interfaces import IVADEngine
from videoscribe.domain.models import VADContext, SpeechSegment
from videoscribe.domain.transcription_options import TranscriptionOptions

try:
    from faster_whisper.audio import decode_audio
    HAS_DECODE_AUDIO = True
except ImportError:
    HAS_DECODE_AUDIO = False

logger = logging.getLogger(__name__)


class SileroEngine(IVADEngine):
    """
    Voice Activity Detection Engine powered by Silero VAD v6.
    Implements the IVADEngine domain interface.
    """

    def __init__(self, use_onnx: bool = False) -> None:
        self.use_onnx = use_onnx
        self._model: Optional[Any] = None
        self._get_speech_ts_fn: Optional[Callable] = None
        self._init_model()

    def _init_model(self) -> None:
        """Initializes Silero VAD v6 model via silero-vad package or torch.hub fallback."""
        if HAS_SILERO_VAD_PKG:
            logger.info("SileroEngine: Loading model via silero_vad package...")
            self._model = silero_pkg_load(onnx=self.use_onnx)
            self._get_speech_ts_fn = silero_pkg_get_speech_ts
            return

        logger.info("SileroEngine: silero_vad package not found, falling back to torch.hub...")
        try:
            model, utils = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                force_reload=False,
                onnx=self.use_onnx,
                trust_repo=True,
            )
            (get_speech_ts_fn, _, _, _, _) = utils
            self._model = model
            self._get_speech_ts_fn = get_speech_ts_fn
        except Exception as e:
            logger.error(f"SileroEngine: Failed to load Silero VAD v6 model: {e}")
            raise RuntimeError(f"Silero VAD v6 model loading failed: {e}") from e

    def predict(self, audio_path: str, options: TranscriptionOptions) -> VADContext:
        if self._model is None or self._get_speech_ts_fn is None:
            raise RuntimeError("SileroEngine is not properly initialized.")

        logger.info(f"SileroEngine: Running Silero VAD v6 on {audio_path}")

        # Decode audio to 16kHz mono float32 numpy array
        if HAS_DECODE_AUDIO:
            audio_array = decode_audio(audio_path, sampling_rate=16000)
        elif HAS_TORCHAUDIO:
            waveform, sample_rate = torchaudio.load(audio_path)
            if sample_rate != 16000:
                resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
                waveform = resampler(waveform)
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)
            audio_array = waveform.squeeze().numpy()
        else:
            raise RuntimeError("Neither faster_whisper.audio nor torchaudio is available for audio decoding.")

        waveform_tensor = torch.from_numpy(audio_array).float()
        audio_duration = len(audio_array) / 16000.0

        # Get Probabilities (the raw tensor)
        with torch.no_grad():
            if hasattr(self._model, 'audio_forward'):
                probs_tensor = self._model.audio_forward(waveform_tensor, 16000)
            else:
                probs_tensor = self._model(waveform_tensor, 16000)
            probs = probs_tensor.squeeze().cpu().numpy()

        # Get Segments using native post-processing
        # We do NOT apply max_speech_duration_s here, we let the pipeline's MinCutProcessor handle it beautifully!
        kwargs = {
            "threshold": 0.5,
            "min_speech_duration_ms": 250,
            "min_silence_duration_ms": 500,
            "speech_pad_ms": 30,
            "return_seconds": True,
            "sampling_rate": 16000,
        }

        timestamps: List[dict] = self._get_speech_ts_fn(
            waveform_tensor,
            self._model,
            **kwargs,
        )

        segments = [
            SpeechSegment(start_time=float(ts["start"]), end_time=float(ts["end"]))
            for ts in timestamps
        ]

        logger.info(f"SileroEngine: Generated {len(segments)} initial native segments.")

        return VADContext(
            segments=segments,
            frame_probabilities=probs,
            sample_rate=16000,
            audio_duration=audio_duration
        )
