import sys
import json
import uuid
from typing import Dict, Any

from videoscribe.domain.interfaces import ProgressReporter
from videoscribe.domain.models import TranscriptionSegment


class IpcReporter(ProgressReporter):
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.ordinal = 0

    def _write_event(self, event_type: str, data: Dict[str, Any]) -> None:
        payload = {
            "version": 1,
            "event": event_type,
            "data": data
        }
        # NDJSON requires exactly one JSON object per line, followed by a newline
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        sys.stdout.flush()

    def report_initial_state(self, device: str, compute_type: str, language: str) -> None:
        self._write_event("job_state", {
            "job_id": self.job_id,
            "status": "starting",
            "progress": 0,
            "runtime_device": device,
            "runtime_compute_type": compute_type,
            "language": language
        })

    def report_progress(self, status: str, progress: int) -> None:
        self._write_event("job_state", {
            "job_id": self.job_id,
            "status": status,
            "progress": progress
        })

    def report_result(self, segment: TranscriptionSegment) -> None:
        cue = {
            "id": str(uuid.uuid4()),
            "ordinal": self.ordinal,
            "start_ms": int(segment.start * 1000),
            "end_ms": int(segment.end * 1000),
            "text": segment.text
        }
        self.ordinal += 1

        self._write_event("segment_batch", {
            "job_id": self.job_id,
            "cues": [cue]
        })

    def report_error(self, message: str) -> None:
        self._write_event("job_state", {
            "job_id": self.job_id,
            "status": "failed",
            "error_message": message
        })

    def report_language(self, language: str) -> None:
        self._write_event("job_state", {
            "job_id": self.job_id,
            "status": "transcribing",
            "language": language
        })
