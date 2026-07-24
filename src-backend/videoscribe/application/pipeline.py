from abc import ABC, abstractmethod
from typing import List, Optional

from videoscribe.domain.interfaces import ProgressReporter, SpeechRecognizer, VADAnalyzer, MSSAnalyzer, ForcedAlignmentAnalyzer
from videoscribe.domain.transcription_options import TranscriptionOptions
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.models import TaskType, TaskStatus

class PipelineContext:
    def __init__(
        self,
        audio_path: str,
        options: TranscriptionOptions,
        reporter: ProgressReporter,
        cancel_token: CancellationToken,
        mss_analyzer: Optional[MSSAnalyzer] = None,
        vad_analyzer: Optional[VADAnalyzer] = None,
        stt_recognizer: Optional[SpeechRecognizer] = None,
        fa_analyzer: Optional[ForcedAlignmentAnalyzer] = None
    ):
        self.audio_path = audio_path
        self.options = options
        self.reporter = reporter
        self.cancel_token = cancel_token
        self.mss_analyzer = mss_analyzer
        self.vad_analyzer = vad_analyzer
        self.stt_recognizer = stt_recognizer
        self.fa_analyzer = fa_analyzer

        # Shared state across steps
        self.vocals_path: Optional[str] = None
        self.instrumental_path: Optional[str] = None
        self.detected_language: Optional[str] = None
        self.vad_result: Optional[VADResult] = None
        self.stt_segments: List[TranscriptionSegment] = []


class PipelineStep(ABC):
    @property
    @abstractmethod
    def task_type(self) -> TaskType:
        """Returns the task type of this step."""
        pass

    @abstractmethod
    def execute(self, context: PipelineContext) -> None:
        """Executes the pipeline step."""
        pass


class TranscriptionPipeline:
    def __init__(self, context: PipelineContext):
        self.context = context
        self.steps: List[PipelineStep] = []

    def add_step(self, step: PipelineStep) -> 'TranscriptionPipeline':
        self.steps.append(step)
        return self

    def execute(self) -> None:
        """Executes all registered steps sequentially."""
        try:
            for step in self.steps:
                # Check for cancellation before starting the next step
                if self.context.cancel_token.is_cancelled:
                    self._cancel_remaining_steps(step)
                    return

                # Notify that the step is starting
                self.context.reporter.report_task_progress(step.task_type, TaskStatus.RUNNING, 0.0)

                try:
                    step.execute(self.context)
                    
                    # Notify completion
                    self.context.reporter.report_task_progress(
                        step.task_type, 
                        TaskStatus.COMPLETED, 
                        100.0,
                        vocals_path=self.context.vocals_path,
                        instrumental_path=self.context.instrumental_path
                    )
                except Exception as e:
                    # Notify failure
                    self.context.reporter.report_task_progress(
                        step.task_type, 
                        TaskStatus.ERROR, 
                        error_message=str(e)
                    )
                    raise e  # re-raise to abort the pipeline

        except Exception as e:
            self.context.reporter.report_error(str(e))
            raise e
            
    def _cancel_remaining_steps(self, from_step: PipelineStep) -> None:
        start_cancelling = False
        for step in self.steps:
            if step == from_step:
                start_cancelling = True
            
            if start_cancelling:
                self.context.reporter.report_task_progress(step.task_type, TaskStatus.CANCELLED)
