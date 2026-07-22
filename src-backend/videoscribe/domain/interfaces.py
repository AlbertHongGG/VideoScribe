from typing import Protocol, Iterator, Tuple, Optional, Any
from .models import TranscriptionSegment, TranscriptionInfo, AudioWindow, Word, VADResult
from .transcription_options import TranscriptionOptions
from .cancellation import CancellationToken

class AudioAnalyzer(Protocol):
    def get_duration(self, audio_path: str) -> float:
        """Get the total duration of the audio in seconds."""
        ...

class VADAnalyzer(Protocol):
    def analyze(self, audio_path: str, options: TranscriptionOptions) -> Optional[VADResult]:
        """
        Analyze audio and return VAD result.
        If the implementation delegates VAD to the STT engine natively, it should return None.
        """
        ...

class MSSAnalyzer(Protocol):
    def separate(self, audio_path: str, options: TranscriptionOptions) -> str:
        """
        Separate audio source (e.g. vocals from instrumental) and return the path
        to the processed audio containing only the target source (vocals).
        """
        ...

class SpeechRecognizer(Protocol):
    def load_model(self, options: TranscriptionOptions) -> None:
        """Load the STT model using the provided options."""
        ...
        
    def transcribe_file(self, audio_path: str, options: TranscriptionOptions, cancel_token: Optional['CancellationToken'] = None) -> Tuple[Iterator[Any], Optional[TranscriptionInfo]]:
        """Transcribe an audio file and yield segments."""
        ...

class ProgressReporter(Protocol):
    def report_initial_state(self, device: str, compute_type: str, language: str) -> None:
        """Report initial job state with runtime info."""
        ...
        
    def report_progress(self, status: str, progress: int) -> None:
        """Report operation progress (0-100)."""
        ...
        
    def report_result(self, segment: TranscriptionSegment) -> None:
        """Report a newly transcribed segment."""
        ...
        
    def report_error(self, message: str) -> None:
        """Report an error."""
        ...
        
    def report_language(self, language: str) -> None:
        """Report the detected language."""
        ...
