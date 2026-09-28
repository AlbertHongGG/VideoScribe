from typing import Protocol, Iterator, Tuple, Optional, Any, Callable
from .models import TranscriptionSegment, TranscriptionInfo, SpeechSegment, Word, VADResult, VADContext, MSSResult, TaskType, TaskStatus
from .transcription_options import TranscriptionOptions
from .cancellation import CancellationToken

class AudioAnalyzer(Protocol):
    def get_duration(self, audio_path: str) -> float:
        """Get the total duration of the audio in seconds."""
        ...

class IVADEngine(Protocol):
    def predict(self, audio_path: str, options: TranscriptionOptions) -> VADContext:
        """
        Run the VAD neural network and return VADContext (containing frame_probabilities or initial segments).
        """
        ...

class IVADProcessor(Protocol):
    def process(self, context: VADContext) -> VADContext:
        """
        Process the VADContext in the pipeline (e.g. merge, min-cut).
        """
        ...

class VADAnalyzer(Protocol):
    def analyze(self, audio_path: str, options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> Optional[VADResult]:
        """
        Facade for the VAD Pipeline.
        """
        ...

class MSSAnalyzer(Protocol):
    def separate(self, audio_path: str, options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> MSSResult:
        """
        Separate audio source (e.g. vocals from instrumental) and return MSSResult
        containing paths to vocals and instrumental stems.
        """
        ...

class ForcedAlignmentAnalyzer(Protocol):
    def align(self, audio_path: str, segments: list[TranscriptionSegment], options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> list[TranscriptionSegment]:
        """
        Perform forced alignment on the audio using the transcribed segments,
        and return the updated segments with corrected timestamps.
        """
        ...

class SpeechRecognizer(Protocol):
    def load_model(self, options: TranscriptionOptions) -> None:
        """Load the STT model using the provided options."""
        ...
        
    def transcribe_file(self, audio_path: str, options: TranscriptionOptions, cancel_token: Optional['CancellationToken'] = None, vad_result: Optional['VADResult'] = None) -> Tuple[Iterator[TranscriptionSegment], Optional[TranscriptionInfo]]:
        """Transcribe an audio file and yield standardized TranscriptionSegments."""
        ...

class ProgressReporter(Protocol):
    def report_task_progress(self, task_type: 'TaskType', status: 'TaskStatus', progress: Optional[float] = None, **kwargs) -> None:
        """Report progress for a specific pipeline task."""
        ...
        
    def report_result(self, segment: TranscriptionSegment) -> None:
        """Report a newly transcribed segment."""
        pass

    def report_result_replace_all(self, segments: list) -> None:
        """Replace all currently reported segments with a new list."""
        pass
        
    def report_error(self, message: str) -> None:
        """Report a global error."""
        ...
