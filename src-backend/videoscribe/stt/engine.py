import json
import sys
from faster_whisper import WhisperModel
from .models import STTResult, TranscriptionInfo

class STTEngine:
    def __init__(self, model_size: str = "medium", device: str = "auto", compute_type: str = "default"):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self._emit_progress("loading_model", 0)
        
        try:
            self._model = WhisperModel(self.model_size, device=self.device, compute_type=self.compute_type)
        except Exception as e:
            self._emit_error(f"Failed to load model: {str(e)}")
            sys.exit(1)

    def _emit_progress(self, status: str, progress: int):
        print(json.dumps({"type": "progress", "status": status, "progress": progress}), flush=True)
        
    def _emit_result(self, result: STTResult):
        print(json.dumps({
            "type": "result",
            "start": result.start,
            "end": result.end,
            "text": result.text
        }), flush=True)

    def _emit_error(self, message: str):
        print(json.dumps({"type": "error", "message": message}), flush=True)

    def transcribe(self, audio_path: str, language: str = "auto"):
        self._emit_progress("transcribing", 0)
        
        transcribe_kwargs = {
            "beam_size": 5,
            "vad_filter": False,
            "word_timestamps": True,
            "condition_on_previous_text": False
        }
        
        if language != "auto":
            transcribe_kwargs["language"] = language

        try:
            segments, info = self._model.transcribe(audio_path, **transcribe_kwargs)
            
            # Print to stderr for debugging (won't be captured as JSON payload)
            print(f"Detected language: {info.language} with probability {info.language_probability:.2f}", file=sys.stderr)
            print(f"Total duration: {info.duration}s", file=sys.stderr)
            
            print(json.dumps({"type": "language", "language": info.language}), flush=True)

            
            for segment in segments:
                # Extract precise vocal boundaries from word-level timestamps
                start_time = float(segment.words[0].start) if segment.words else float(segment.start)
                end_time = float(segment.words[-1].end) if segment.words else float(segment.end)

                res = STTResult(
                    start=start_time,
                    end=end_time,
                    text=str(segment.text).strip()
                )
                self._emit_result(res)
                
                if info.duration > 0:
                    progress_pct = min(100, int((segment.end / info.duration) * 100))
                    self._emit_progress("transcribing", progress_pct)
                    
        except Exception as e:
            self._emit_error(f"Transcription failed: {str(e)}")
            sys.exit(1)

        self._emit_progress("completed", 100)

