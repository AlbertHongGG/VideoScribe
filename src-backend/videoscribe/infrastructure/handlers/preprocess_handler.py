import os
from typing import Dict, Any, Optional
from datetime import datetime

from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.infrastructure.audio.ffmpeg_analyzer import FFmpegAudioAnalyzer
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter

class PreprocessHandler(BaseHandler):
    def __init__(self):
        self.analyzer = FFmpegAudioAnalyzer()

    def cleanup(self):
        pass # No heavy resources to clean up

    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken]):
        import logging
        logger = logging.getLogger("preprocess_handler")
        logger.info(f"PreprocessHandler started for job {job_id}")
        try:
            reporter = IpcReporter(job_id)
            logger.info("Sending TaskProgress RUNNING")
            reporter.report_task_progress(TaskType.PREPROCESS, TaskStatus.RUNNING, 0.0)
            logger.info("Successfully sent TaskProgress RUNNING")

            video_path = payload_data.get("video_path")
            job_workspace = payload_data.get("workspace_dir")

            if not video_path:
                raise ValueError("Missing video_path in payload")
            if not job_workspace:
                raise ValueError("Missing workspace_dir in payload")

            wav_path = os.path.join(job_workspace, "extracted_audio.wav")
            
            logger.info(f"Running ffmpeg extraction to {wav_path}")
            wav_path = self.analyzer.extract_audio(video_path, job_workspace)
            logger.info("FFmpeg extraction complete")

            # We pass the resulting wav path back as vocals_path for now
            # since vocals_path is an Optional<String> in TaskProgressData
            reporter.report_task_progress(TaskType.PREPROCESS, TaskStatus.COMPLETED, 100.0, vocals_path=wav_path)
            logger.info("PreprocessHandler completed successfully")
            
        except Exception as e:
            logger.error(f"PreprocessHandler failed: {e}", exc_info=True)
            reporter = IpcReporter(job_id)
            reporter.report_task_progress(TaskType.PREPROCESS, TaskStatus.ERROR, 0.0, error_message=str(e))
