import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class Word:
    text: str
    start: float
    end: float
    probability: float

@dataclass
class TranscriptionSegment:
    start: float
    end: float
    text: str
    words: List[Word] = field(default_factory=list)

@dataclass
class TranscriptionInfo:
    language: str
    language_probability: float
    duration: float
    all_language_probs: Optional[list] = None

@dataclass
class AudioWindow:
    audio: np.ndarray
    start_time: float
    end_time: float
    is_last: bool

@dataclass
class VADResult:
    """
    Rich domain model representing the result of VAD analysis.
    Regulates the output format for various consumers.
    """
    windows: list[AudioWindow]

    @property
    def is_empty(self) -> bool:
        return len(self.windows) == 0

    def merge_and_pad(self, padding_sec: float = 2.0, total_duration: Optional[float] = None) -> 'VADResult':
        """
        Pads each speech window by padding_sec before and after,
        and merges any overlapping or adjacent windows.
        """
        if not self.windows:
            return VADResult(windows=[])

        # 1. Expand with padding
        expanded_intervals = []
        for w in self.windows:
            p_start = max(0.0, w.start_time - padding_sec)
            p_end = w.end_time + padding_sec
            if total_duration is not None and total_duration > 0:
                p_end = min(total_duration, p_end)
            expanded_intervals.append((p_start, p_end))

        # 2. Sort intervals by start time
        expanded_intervals.sort(key=lambda x: x[0])

        # 3. Merge overlapping intervals
        merged_intervals: list[tuple[float, float]] = []
        for cur_start, cur_end in expanded_intervals:
            if not merged_intervals:
                merged_intervals.append((cur_start, cur_end))
            else:
                prev_start, prev_end = merged_intervals[-1]
                if cur_start <= prev_end:
                    # Overlap detected, extend the end time of the previous interval
                    merged_intervals[-1] = (prev_start, max(prev_end, cur_end))
                else:
                    merged_intervals.append((cur_start, cur_end))

        # 4. Construct new AudioWindow objects
        new_windows = [
            AudioWindow(
                audio=np.array([]),
                start_time=start,
                end_time=end,
                is_last=(i == len(merged_intervals) - 1)
            )
            for i, (start, end) in enumerate(merged_intervals)
        ]
        return VADResult(windows=new_windows)

    def to_dict_list(self) -> list[dict]:
        """Returns format required by Batched Inference (list of dicts)."""
        return [{"start": w.start_time, "end": w.end_time} for w in self.windows]

    def to_flat_list(self) -> list[float]:
        """Returns format required by Standard Inference (flat list of floats)."""
        flat_list = []
        for w in self.windows:
            flat_list.extend([w.start_time, w.end_time])
        return flat_list

@dataclass
class MSSResult:
    """
    Domain model representing separated audio stems.
    """
    vocals_path: str
    instrumental_path: Optional[str] = None