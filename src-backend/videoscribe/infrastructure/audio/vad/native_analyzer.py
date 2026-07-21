from typing import Iterator, Optional
from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.models import AudioWindow
from videoscribe.domain.transcription_options import TranscriptionOptions

class NativeVADAnalyzer(VADAnalyzer):
    """
    A VAD analyzer that delegates to the underlying STT engine's native VAD (e.g., FasterWhisper vad_filter).
    It returns None, indicating that the caller should just pass the options to the STT engine.
    """
    
    def analyze(self, audio_path: str, options: TranscriptionOptions) -> Optional[Iterator[AudioWindow]]:
        # Native VAD does not pre-process into chunks, it relies on the STT engine.
        return None
