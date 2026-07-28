from typing import Dict, Any, Optional
import os
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import MssPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.domain.transcription_options import TranscriptionOptions, MSSEngineType
from videoscribe.infrastructure.audio.mss.factory import MSSFactory
from videoscribe.infrastructure.audio.ffmpeg_analyzer import FFmpegAudioAnalyzer
from videoscribe.infrastructure.utils import get_device

class MssHandler(BaseHandler):
    def __init__(self):
        pass

    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        try:
            payload = MssPayload(**payload_data)
        except TypeError as e:
            IpcReporter(job_id).report_error(f"Invalid payload: {e}")
            return
            
        
        
        reporter = IpcReporter(job_id)
        reporter.report_task_progress(TaskType.MSS, TaskStatus.RUNNING, 0.0)
        
        try:
            mss_engine_enum = MSSEngineType(payload.mss_engine)
            options = TranscriptionOptions(mss_engine=mss_engine_enum, mss_model=payload.mss_model, device=get_device())
            mss_analyzer = MSSFactory.create(options)
            if mss_analyzer:
                def progress_callback(pct: float):
                    reporter.report_task_progress(TaskType.MSS, TaskStatus.RUNNING, pct)
                result = mss_analyzer.separate(payload.audio_path, options, progress_callback)
                reporter.report_task_progress(TaskType.MSS, TaskStatus.COMPLETED, 100.0, vocals_path=result.vocals_path, instrumental_path=result.instrumental_path)
            else:
                reporter.report_task_progress(TaskType.MSS, TaskStatus.COMPLETED, 100.0)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.MSS, TaskStatus.ERROR, error_message=str(e))
