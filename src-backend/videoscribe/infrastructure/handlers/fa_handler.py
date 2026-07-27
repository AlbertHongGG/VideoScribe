from typing import Dict, Any, Optional
import torch
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import FaPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.domain.transcription_options import TranscriptionOptions, ForcedAlignmentEngineType
from videoscribe.infrastructure.audio.alignment.factory import ForcedAlignmentFactory
from videoscribe.domain.stt_job import SttCue

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
                    cues.append(SttCue(id=str(idx), ordinal=idx, start_ms=int(t["start"]*1000), end_ms=int(t["end"]*1000), text=t["text"], words=[]))
                
                aligned_cues = fa_analyzer.align(payload.audio_path, cues, reporter, cancel_token)
                reporter.report_segment_replace_all([c.to_dict() for c in aligned_cues])
                
            reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.COMPLETED, 100.0)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.FORCED_ALIGNMENT, TaskStatus.ERROR, error_message=str(e))
