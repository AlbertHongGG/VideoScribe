import sys
import json
from typing import Any, Dict
from videoscribe.domain.models import TranscriptionSegment
from videoscribe.domain.interfaces import ProgressReporter

class NdjsonReporter(ProgressReporter):
    def _write_event(self, event_type: str, data: Dict[str, Any]) -> None:
        payload = {
            "version": 1,
            "event": event_type,
            "data": data
        }
        # NDJSON requires exactly one JSON object per line, followed by a newline
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    def report_progress(self, status: str, progress: int) -> None:
        # Note: the rust side expects job_state for progress updates
        # But we'll just emit generic progress events for now, and worker will wrap them if needed.
        self._write_event("progress", {
            "status": status,
            "progress": progress
        })
        
    def report_result(self, segment: TranscriptionSegment) -> None:
        # Translate domain model to a dict format that matches the stt_job cue
        words = [{"text": w.text, "start": w.start, "end": w.end} for w in segment.words]
        self._write_event("segment", {
            "start": segment.start,
            "end": segment.end,
            "text": segment.text,
            "words": words
        })
        
    def report_error(self, message: str) -> None:
        self._write_event("error", {
            "message": message
        })
        
    def report_language(self, language: str) -> None:
        self._write_event("language", {
            "language": language
        })
