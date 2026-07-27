from typing import Dict, Any, Optional
import torch
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import VadPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType
from videoscribe.infrastructure.audio.vad.factory import VADFactory

class VadHandler(BaseHandler):
    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        try:
            payload = VadPayload(**payload_data)
        except TypeError as e:
            IpcReporter(job_id).report_error(f"Invalid payload: {e}")
            return
            
        reporter = IpcReporter(job_id)
        reporter.report_task_progress(TaskType.VAD, TaskStatus.RUNNING, 0.0)
        
        try:
            vad_engine_enum = VADEngineType(payload.vad_engine)
            options = TranscriptionOptions(vad_engine=vad_engine_enum, device="cuda" if torch.cuda.is_available() else "cpu")
            vad_analyzer = VADFactory.create(options)
            
            segments = None
            if vad_analyzer:
                segments = vad_analyzer.analyze(payload.audio_path, reporter, cancel_token)
                
            reporter.report_task_progress(TaskType.VAD, TaskStatus.COMPLETED, 100.0)
            return segments
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.VAD, TaskStatus.ERROR, error_message=str(e))
            return None
