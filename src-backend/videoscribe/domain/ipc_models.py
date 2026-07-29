from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from videoscribe.domain.models import TaskType, TaskStatus

@dataclass
class PreprocessPayload:
    video_path: str
    workspace_dir: str

@dataclass
class MssPayload:
    audio_path: str
    mss_engine: str
    mss_model: str
    workspace_dir: str

@dataclass
class VadPayload:
    audio_path: str
    vad_engine: str

@dataclass
class SttPayload:
    audio_path: str
    model: str
    language: str
    use_batch: bool
    batch_size: int
    vad_engine: str
    vad_segments: Optional[List[Dict[str, Any]]] = None

@dataclass
class FaPayload:
    audio_path: str
    fa_engine: str
    fa_model: str
    transcripts: List[Dict[str, Any]]

@dataclass
class IpcCommand:
    action: str
    job_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'IpcCommand':
        return cls(
            action=data.get("action", "unknown"),
            job_id=data.get("job_id"),
            payload=data.get("payload")
        )

@dataclass
class TaskProgressData:
    job_id: str
    task_type: TaskType
    status: TaskStatus
    progress: Optional[float] = None
    error_message: Optional[str] = None
    runtime_device: Optional[str] = None
    runtime_compute_type: Optional[str] = None
    vocals_path: Optional[str] = None
    instrumental_path: Optional[str] = None

@dataclass
class CueData:
    id: str
    ordinal: int
    start_ms: int
    end_ms: int
    text: str

@dataclass
class SegmentBatchData:
    job_id: str
    cues: List[Dict[str, Any]] # simplified for now, or List[CueData]

@dataclass
class IpcEvent:
    event: str
    data: Dict[str, Any]
    version: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "event": self.event,
            "data": self.data
        }
