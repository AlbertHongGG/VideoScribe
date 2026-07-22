import sys
import json
import uuid
from typing import Dict, Any, Optional

from videoscribe.domain.interfaces import ProgressReporter
from videoscribe.domain.models import TranscriptionSegment, TaskType, TaskStatus


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

    def report_task_progress(self, task_type: TaskType, status: TaskStatus, progress: Optional[float] = None, **kwargs) -> None:
        data = {
            "job_id": self.job_id,
            "task_type": task_type.value,
            "status": status.value,
        }
        if progress is not None:
            data["progress"] = progress
        data.update(kwargs)
        self._write_event("task_progress", data)

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
        self._write_event("error", {
            "message": message
        })
