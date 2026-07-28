from typing import Dict, Any, Optional, List

from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken, CancelledException
from videoscribe.domain.ipc_models import SttPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.infrastructure.utils import get_device
from videoscribe.domain.models import TaskType, TaskStatus, VADResult, SpeechSegment
from videoscribe.domain.transcription_options import TranscriptionOptions

class SttHandler(BaseHandler):
    def __init__(self):
        self._recognizer = None

    @property
    def recognizer(self):
        if self._recognizer is None:
            from videoscribe.infrastructure.recognizers.faster_whisper_engine import FasterWhisperEngine
            self._recognizer = FasterWhisperEngine()
        return self._recognizer

    def handle(self, job_id: str, payload_data: Dict[str, Any], cancel_token: Optional[CancellationToken], cached_vad_segments: Optional[List[Dict[str, Any]]] = None):
        try:
            payload = SttPayload(**payload_data)
        except TypeError as e:
            IpcReporter(job_id).report_error(f"Invalid payload: {e}")
            return
            
        reporter = IpcReporter(job_id)
        
        
        device = get_device()
        is_gpu = device == "cuda"
        compute_type = "float16" if is_gpu else "int8"
        
        reporter.report_task_progress(TaskType.STT, TaskStatus.RUNNING, 0.0, runtime_device=device, runtime_compute_type=compute_type, language=payload.language)
        
        try:
            options = TranscriptionOptions(
                model_size=payload.model,
                device=device,
                compute_type=compute_type,
                language=payload.language,
                use_batch=payload.use_batch and is_gpu,
                batch_size=payload.batch_size
            )
            
            vad_result_obj = None
            if payload.vad_segments:
                vad_result_obj = VADResult(segments=[SpeechSegment(start_time=s["start"], end_time=s["end"]) for s in payload.vad_segments])
            elif cached_vad_segments:
                if isinstance(cached_vad_segments, VADResult):
                    vad_result_obj = cached_vad_segments
                elif isinstance(cached_vad_segments, list):
                    vad_result_obj = VADResult(segments=[SpeechSegment(start_time=s["start"], end_time=s["end"]) for s in cached_vad_segments])
            
            self.recognizer.load_model(options)
            
            results, info = self.recognizer.transcribe_file(
                payload.audio_path,
                options,
                cancel_token,
                vad_result_obj
            )
            
            final_results = []
            for segment in results:
                final_results.append(segment)
                # Streaming update: replace all reported cues with the updated list
                reporter.report_result_replace_all(final_results)
                
                # Streaming progress: estimate based on segment.end vs total duration
                if info and info.duration > 0:
                    pct = min((segment.end / info.duration) * 100.0, 99.0)
                    reporter.report_task_progress(TaskType.STT, TaskStatus.RUNNING, pct)
                    
            if info:
                reporter.report_task_progress(TaskType.STT, TaskStatus.COMPLETED, 100.0, language=info.language)
            else:
                reporter.report_task_progress(TaskType.STT, TaskStatus.COMPLETED, 100.0)
        except CancelledException as e:
            reporter.report_task_progress(TaskType.STT, TaskStatus.CANCELLED)
        except Exception as e:
            reporter.report_error(str(e))
            reporter.report_task_progress(TaskType.STT, TaskStatus.ERROR, error_message=str(e))
