from typing import Dict, Any, Optional, List
import torch
from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import SttPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.models import TaskType, TaskStatus
from videoscribe.domain.transcription_options import TranscriptionOptions
from videoscribe.domain.prompt_registry import PromptRegistry
from videoscribe.infrastructure.recognizers.faster_whisper_engine import FasterWhisperEngine

class SttHandler(BaseHandler):
    def __init__(self):
        self.recognizer = FasterWhisperEngine()

    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken], cached_vad_segments: Optional[List[Dict[str, Any]]] = None):
        try:
            payload = SttPayload(**payload_data)
        except TypeError as e:
            IpcReporter(job_id).report_error(f"Invalid payload: {e}")
            return
            
        reporter = IpcReporter(job_id)
        is_gpu = torch.cuda.is_available()
        device = "cuda" if is_gpu else "cpu"
        compute_type = "float16" if is_gpu else "int8"
        
        reporter.report_task_progress(TaskType.STT, TaskStatus.RUNNING, 0.0, runtime_device=device, runtime_compute_type=compute_type, language=payload.language)
        
        try:
            options = TranscriptionOptions(
                model_size=payload.model,
                device=device,
                compute_type=compute_type,
                language=payload.language,
                use_batch=payload.use_batch and is_gpu,
                batch_size=payload.batch_size,
                initial_prompt=PromptRegistry.get_prompt(payload.language)
            )
            
            segments_to_use = payload.vad_segments or cached_vad_segments
            
            results = self.recognizer.transcribe(
                payload.audio_path,
                options,
                reporter,
                cancel_token,
                segments_to_use
            )
            
            reporter.report_segment_replace_all([c.to_dict() for c in results])
            reporter.report_task_progress(TaskType.STT, TaskStatus.COMPLETED, 100.0)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.STT, TaskStatus.ERROR, error_message=str(e))
