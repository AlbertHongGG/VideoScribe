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

from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.models import AudioWindow, VADResult
from videoscribe.domain.transcription_options import TranscriptionOptions

try:
    from faster_whisper.audio import decode_audio
    HAS_DECODE_AUDIO = True
except ImportError:
    HAS_DECODE_AUDIO = False

logger = logging.getLogger(__name__)


class SileroVADv6Analyzer(VADAnalyzer):
    """
    Voice Activity Detection Analyzer powered by Silero VAD v6.
    Implements the VADAnalyzer domain interface.
    """

    def __init__(self, use_onnx: bool = False) -> None:
        self.use_onnx = use_onnx
        self._model: Optional[Any] = None
        self._get_speech_ts_fn: Optional[Callable] = None
        self._init_model()

    def _init_model(self) -> None:
        """Initializes Silero VAD v6 model via silero-vad package or torch.hub fallback."""
        if HAS_SILERO_VAD_PKG:
            logger.info("SileroVADv6Analyzer: Loading model via silero_vad package...")
            self._model = silero_pkg_load(onnx=self.use_onnx)
            self._get_speech_ts_fn = silero_pkg_get_speech_ts
            return

        logger.info("SileroVADv6Analyzer: silero_vad package not found, falling back to torch.hub...")
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
            logger.error(f"SileroVADv6Analyzer: Failed to load Silero VAD v6 model: {e}")
            raise RuntimeError(f"Silero VAD v6 model loading failed: {e}") from e

    def analyze(self, audio_path: str, options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> Optional[VADResult]:
        def report(pct: float):
            if progress_callback:
                progress_callback(pct)
                
        if self._model is None or self._get_speech_ts_fn is None:
            logger.error("SileroVADv6Analyzer is not properly initialized.")
            return None

        report(5.0)
        logger.info(f"SileroVADv6Analyzer: Running Silero VAD v6 on {audio_path}")

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

        report(30.0)
        waveform_tensor = torch.from_numpy(audio_array).float()

        # Optimized parameters for high sensitivity to falsetto, singing, and speech over background music
        max_speech_s = float(options.batch_size) if options.use_batch else 30.0
        kwargs = {
            "threshold": 0.5,               # Lowered from 0.5 to capture falsetto, singing & speech mixed with background music
            "min_speech_duration_ms": 250,  # Lowered from 250ms to capture short vocal cues and sung notes
            "max_speech_duration_s": max_speech_s,
            "min_silence_duration_ms": 500, # Increased from 160ms to prevent splitting mid-sentence breath/singing pauses
            "speech_pad_ms": 30,
            "return_seconds": True,
            "sampling_rate": 16000,
        }

        try:
            report(60.0)
            timestamps: List[dict] = self._get_speech_ts_fn(
                waveform_tensor,
                self._model,
                **kwargs,
            )
            report(90.0)

            windows = [
                AudioWindow(
                    audio=np.array([]),
                    start_time=float(ts["start"]),
                    end_time=float(ts["end"]),
                    is_last=(i == len(timestamps) - 1),
                )
                for i, ts in enumerate(timestamps)
            ]

            logger.info(f"SileroVADv6Analyzer: Generated {len(windows)} speech chunks.")
            report(100.0)
            return VADResult(windows=windows)

        except Exception as e:
            logger.error(f"SileroVADv6Analyzer analysis failed: {e}")
            return None
