import os
from typing import Dict, Any, Optional

from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.infrastructure.audio.ffmpeg_analyzer import FFmpegAudioAnalyzer
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter

class PreprocessHandler(BaseHandler):
    def __init__(self):
        self.analyzer = FFmpegAudioAnalyzer()

    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        try:
            reporter = IpcReporter(job_id)
            reporter.report_task_progress(TaskType.PREPROCESS, TaskStatus.RUNNING, 0.0)

            video_path = payload_data.get("video_path")
            workspace_dir = payload_data.get("workspace_dir")

            if not video_path or not workspace_dir:
                raise ValueError("Missing video_path or workspace_dir in payload")

            wav_path = os.path.join(workspace_dir, "extracted_audio.wav")
            if not os.path.exists(wav_path):
                wav_path = self.analyzer.extract_audio(video_path, workspace_dir)

            # We pass the resulting wav path back as vocals_path for now
            # since vocals_path is an Optional<String> in TaskProgressData
            reporter.report_task_progress(TaskType.PREPROCESS, TaskStatus.COMPLETED, 100.0, vocals_path=wav_path)
            
        except Exception as e:
            reporter = IpcReporter(job_id)
            reporter.report_task_progress(TaskType.PREPROCESS, TaskStatus.ERROR, 0.0, error_message=str(e))
