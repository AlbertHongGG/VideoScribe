from typing import Dict, Any, Optional
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import FaPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus, TranscriptionSegment
from videoscribe.domain.transcription_options import TranscriptionOptions, ForcedAlignmentEngineType
from videoscribe.infrastructure.audio.alignment.factory import ForcedAlignmentFactory
from videoscribe.infrastructure.utils import get_device, get_ai_audio_path, clean_memory

class FaHandler(BaseHandler):
    def __init__(self):
        self.fa_analyzer = None

    def cleanup(self):
        if self.fa_analyzer is not None:
            del self.fa_analyzer
            self.fa_analyzer = None
        clean_memory()
        
    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        try:
            payload = FaPayload(**payload_data)
        except TypeError as e:
            IpcReporter(job_id).report_error(f"Invalid payload: {e}")
            return
            
        reporter = IpcReporter(job_id)
        reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.RUNNING, 0.0)
        
        try:
            cues = []
            for idx, t in enumerate(payload.transcripts):
                cues.append(TranscriptionSegment(start=t["start"], end=t["end"], text=t["text"]))

            fa_engine_enum = ForcedAlignmentEngineType(payload.fa_engine)
            options = TranscriptionOptions(fa_engine=fa_engine_enum, fa_model=payload.fa_model, language=cues[0].text if cues else "en") # Pass a default language
            self.fa_analyzer = ForcedAlignmentFactory.create(options)
            
            if self.fa_analyzer:
                def progress_cb(pct: float):
                    reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.RUNNING, pct)
                
                # Convention over Configuration: Intercept with AI track if exists
                audio_to_process = get_ai_audio_path(payload.audio_path)
                
                aligned_cues = self.fa_analyzer.align(audio_to_process, cues, options, progress_cb)
                reporter.report_result_replace_all(aligned_cues)
                
            reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.COMPLETED, 100.0)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.ERROR, error_message=str(e))
        finally:
            self.cleanup()
