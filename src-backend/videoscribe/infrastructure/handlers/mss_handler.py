from typing import Dict, Any, Optional
import os
import subprocess
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import MssPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.domain.transcription_options import TranscriptionOptions, MSSEngineType
from videoscribe.infrastructure.audio.mss.factory import MSSFactory
from videoscribe.infrastructure.audio.ffmpeg_analyzer import FFmpegAudioAnalyzer
from videoscribe.infrastructure.utils import get_device, clean_memory

class MssHandler(BaseHandler):
    def __init__(self):
        self.mss_analyzer = None
        
    def cleanup(self):
        if self.mss_analyzer is not None:
            del self.mss_analyzer
            self.mss_analyzer = None
        clean_memory()

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
            self.mss_analyzer = MSSFactory.create(options)
            if self.mss_analyzer:
                def progress_callback(pct: float):
                    reporter.report_task_progress(TaskType.MSS, TaskStatus.RUNNING, pct)
                result = self.mss_analyzer.separate(payload.audio_path, options, progress_callback)
                
                # Convention over Configuration: Generate 16k AI track for vocals
                if result and result.vocals_path:
                    vocals_16k_path = result.vocals_path.replace(".wav", "_16k.wav")
                    ffmpeg_cmd = [
                        "ffmpeg", "-y",
                        "-i", result.vocals_path,
                        "-vn",
                        "-acodec", "pcm_s16le",
                        "-ar", "16000",
                        "-ac", "1",
                        vocals_16k_path
                    ]
                    subprocess.run(ffmpeg_cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                
                reporter.report_task_progress(TaskType.MSS, TaskStatus.COMPLETED, 100.0, vocals_path=result.vocals_path, instrumental_path=result.instrumental_path)
            else:
                reporter.report_task_progress(TaskType.MSS, TaskStatus.COMPLETED, 100.0)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.MSS, TaskStatus.ERROR, error_message=str(e))
