from typing import Dict, Any, Optional
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import VadPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType
from videoscribe.infrastructure.audio.vad.factory import VADFactory
from videoscribe.infrastructure.utils import get_device, get_ai_audio_path

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
            options = TranscriptionOptions(vad_engine=vad_engine_enum, device=get_device())
            vad_analyzer = VADFactory.create(options)
            # Convention over Configuration: Intercept with AI track if exists
            audio_to_process = get_ai_audio_path(payload.audio_path)
            
            segments = None
            if vad_analyzer:
                def progress_callback(pct: float):
                    reporter.report_task_progress(TaskType.VAD, TaskStatus.RUNNING, pct)
                segments = vad_analyzer.analyze(audio_to_process, options, progress_callback)
                
            reporter.report_vad_segments(segments)
            reporter.report_task_progress(TaskType.VAD, TaskStatus.COMPLETED, 100.0)
            return segments
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.VAD, TaskStatus.ERROR, error_message=str(e))
            return None
