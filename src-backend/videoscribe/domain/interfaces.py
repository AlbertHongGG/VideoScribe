from typing import Protocol, Iterator, Tuple, Optional, Any
from .models import TranscriptionSegment, TranscriptionInfo, AudioWindow, Word, VADResult, MSSResult, TaskType, TaskStatus
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
    def separate(self, audio_path: str, options: TranscriptionOptions) -> MSSResult:
        """
        Separate audio source (e.g. vocals from instrumental) and return MSSResult
        containing paths to vocals and instrumental stems.
        """
        ...

class SpeechRecognizer(Protocol):
    def load_model(self, options: TranscriptionOptions) -> None:
        """Load the STT model using the provided options."""
        ...
        
    def transcribe_file(self, audio_path: str, options: TranscriptionOptions, cancel_token: Optional['CancellationToken'] = None, vad_result: Optional['VADResult'] = None) -> Tuple[Iterator[Any], Optional[TranscriptionInfo]]:
        """Transcribe an audio file and yield segments."""
        ...

class ProgressReporter(Protocol):
    def report_task_progress(self, task_type: 'TaskType', status: 'TaskStatus', progress: Optional[float] = None, **kwargs) -> None:
        """Report progress for a specific pipeline task."""
        ...
        
    def report_result(self, segment: TranscriptionSegment) -> None:
        """Report a newly transcribed segment."""
        ...
        
    def report_error(self, message: str) -> None:
        """Report a global error."""
        ...
