from typing import Dict, Any, Optional
import torch
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import FaPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus, TranscriptionSegment
from videoscribe.domain.transcription_options import TranscriptionOptions, ForcedAlignmentEngineType
from videoscribe.infrastructure.audio.alignment.factory import ForcedAlignmentFactory

class FaHandler(BaseHandler):
    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        try:
            payload = FaPayload(**payload_data)
        except TypeError as e:
            IpcReporter(job_id).report_error(f"Invalid payload: {e}")
            return
            
        reporter = IpcReporter(job_id)
        reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.RUNNING, 0.0)
        
        try:
            fa_engine_enum = ForcedAlignmentEngineType(payload.fa_engine)
            options = TranscriptionOptions(fa_engine=fa_engine_enum, fa_model=payload.fa_model, device="cuda" if torch.cuda.is_available() else "cpu")
            fa_analyzer = ForcedAlignmentFactory.create(options)
            
            if fa_analyzer:
                cues = []
                for idx, t in enumerate(payload.transcripts):
                    cues.append(TranscriptionSegment(start=t["start"], end=t["end"], text=t["text"]))
                
                def progress_cb(pct: float):
                    reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.RUNNING, pct)
                
                aligned_cues = fa_analyzer.align(payload.audio_path, cues, options, progress_cb)
                reporter.report_result_replace_all(aligned_cues)
                
            reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.COMPLETED, 100.0)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.ERROR, error_message=str(e))
