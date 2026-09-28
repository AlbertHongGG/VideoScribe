from typing import Dict, Any, Optional, List

from videoscribe.infrastructure.handlers.base import BaseHandler
from videoscribe.domain.cancellation import CancellationToken, CancelledException
from videoscribe.domain.ipc_models import SttPayload
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.infrastructure.utils import get_device, get_ai_audio_path, clean_memory
from videoscribe.domain.models import TaskType, TaskStatus, VADResult, SpeechSegment
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType, STTEngineType
from videoscribe.infrastructure.recognizers import STTFactory

class SttHandler(BaseHandler):
    def __init__(self):
        self._recognizer = None
        self._current_engine_type = None

    def get_recognizer(self, options: TranscriptionOptions):
        if self._recognizer is None or self._current_engine_type != options.stt_engine:
            if self._recognizer is not None:
                del self._recognizer
                self._recognizer = None
                clean_memory()
            self._recognizer = STTFactory.create(options)
            self._current_engine_type = options.stt_engine
        return self._recognizer
        
    def cleanup(self):
        if self._recognizer is not None:
            del self._recognizer
            self._recognizer = None
            self._current_engine_type = None
        clean_memory()

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
        
        lang = payload.language
        if lang == "auto":
            lang = None
            
        reporter.report_task_progress(TaskType.STT, TaskStatus.RUNNING, 0.0, runtime_device=device, runtime_compute_type=compute_type, language=lang)
        
        vad_engine_enum = VADEngineType(payload.vad_engine) if payload.vad_engine in ["off", "native", "silero_v6", "firered_vad"] else VADEngineType.OFF
        raw_stt_engine = getattr(payload, "stt_engine", "faster_whisper")
        stt_engine_enum = STTEngineType(raw_stt_engine) if raw_stt_engine in [e.value for e in STTEngineType] else STTEngineType.FASTER_WHISPER
        
        try:
            options = TranscriptionOptions(
                stt_engine=stt_engine_enum,
                model_size=payload.model,
                device=device,
                compute_type=compute_type,
                language=lang,
                vad_engine=vad_engine_enum,
                use_batch=payload.use_batch and is_gpu,
                batch_size=payload.batch_size
            )
            
            vad_result_obj = None
            # Architectural Fix: Single Source of Truth.
            # Only consume the cached VAD payload if the user actually requested an external VAD engine.
            # This prevents stale frontend state (state leakage) from overriding the user's intent to turn VAD off.
            if options.vad_engine in [VADEngineType.SILERO_V6, VADEngineType.FIRERED_VAD]:
                if payload.vad_segments:
                    vad_result_obj = VADResult(segments=[SpeechSegment(start_time=s["start"], end_time=s["end"]) for s in payload.vad_segments])
                elif cached_vad_segments:
                    if isinstance(cached_vad_segments, VADResult):
                        vad_result_obj = cached_vad_segments
                    elif isinstance(cached_vad_segments, list):
                        vad_result_obj = VADResult(segments=[SpeechSegment(start_time=s["start"], end_time=s["end"]) for s in cached_vad_segments])
            
            recognizer = self.get_recognizer(options)
            if not recognizer:
                raise RuntimeError(f"Unsupported STT engine: {options.stt_engine}")

            recognizer.load_model(options)
            
            # Convention over Configuration: Intercept with AI track if exists
            audio_to_process = get_ai_audio_path(payload.audio_path)
            
            results, info = recognizer.transcribe_file(
                audio_to_process,
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
