import logging
import numpy as np
from typing import List, Optional
from videoscribe.domain.models import VADContext, SpeechSegment
from videoscribe.domain.interfaces import IVADProcessor

logger = logging.getLogger(__name__)

class VADPipeline:
    def __init__(self, processors: List[IVADProcessor]):
        self.processors = processors

    def run(self, context: VADContext) -> VADContext:
        for p in self.processors:
            context = p.process(context)
        return context

class SmartMergeProcessor(IVADProcessor):
    """
    Merges adjacent speech segments if the gap between them is small,
    and if the resulting merged segment length does not exceed max_chunk_sec.
    """
    def __init__(self, max_chunk_sec: float = 30.0, max_gap_sec: float = 1.0):
        self.max_chunk_sec = max_chunk_sec
        self.max_gap_sec = max_gap_sec

    def process(self, context: VADContext) -> VADContext:
        if not context.segments:
            return context

        merged: List[SpeechSegment] = []
        for current in sorted(context.segments, key=lambda s: s.start_time):
            if not merged:
                merged.append(current)
                continue

            prev = merged[-1]
            gap = current.start_time - prev.end_time
            combined_len = current.end_time - prev.start_time

            if gap <= self.max_gap_sec and combined_len <= self.max_chunk_sec:
                # Merge them
                merged[-1] = SpeechSegment(
                    start_time=prev.start_time,
                    end_time=current.end_time
                )
            else:
                merged.append(current)

        context.segments = merged
        logger.info(f"SmartMergeProcessor: Merged to {len(context.segments)} segments.")
        return context

class MinCutProcessor(IVADProcessor):
    """
    Splits any segment longer than max_chunk_sec by finding the lowest
    speech probability point near the middle of the segment.
    """
    def __init__(self, max_chunk_sec: float = 30.0, pad_sec: float = 0.0):
        self.max_chunk_sec = max_chunk_sec
        self.pad_sec = pad_sec

    def process(self, context: VADContext) -> VADContext:
        if not context.segments:
            return context

        if context.frame_probabilities is None or context.audio_duration <= 0:
            logger.warning("MinCutProcessor: No frame_probabilities or audio_duration. Falling back to hard splits.")
            return self._hard_split(context)

        probs = context.frame_probabilities
        num_frames = len(probs)
        frame_dur = context.audio_duration / num_frames

        cut_segments: List[SpeechSegment] = []
        
        for seg in context.segments:
            self._recursive_cut(seg, probs, frame_dur, cut_segments)

        context.segments = cut_segments
        logger.info(f"MinCutProcessor: Resulted in {len(context.segments)} segments (all <= {self.max_chunk_sec}s).")
        return context

    def _recursive_cut(self, seg: SpeechSegment, probs: np.ndarray, frame_dur: float, out_list: List[SpeechSegment]):
        duration = seg.end_time - seg.start_time
        if duration <= self.max_chunk_sec:
            out_list.append(seg)
            return

        # Need to cut
        start_frame = int(seg.start_time / frame_dur)
        end_frame = int(seg.end_time / frame_dur)
        
        # Ensure bounds
        start_frame = max(0, min(start_frame, len(probs) - 1))
        end_frame = max(0, min(end_frame, len(probs)))
        
        if end_frame <= start_frame:
            # Fallback
            out_list.append(seg)
            return

        curr_probs = probs[start_frame:end_frame]
        
        # To avoid cutting at the very edges which defeats the purpose of dividing the chunk,
        # we only search for a minimum in the middle 50% of the segment.
        search_start = len(curr_probs) // 4
        search_end = search_start + len(curr_probs) // 2
        
        if search_end <= search_start:
             min_idx_relative = len(curr_probs) // 2
        else:
            # Find index of minimum probability
            min_idx_relative = search_start + np.argmin(curr_probs[search_start:search_end])
            
        cut_frame = start_frame + min_idx_relative
        cut_time = cut_frame * frame_dur

        # Create left and right segments
        left_seg = SpeechSegment(start_time=round(seg.start_time, 3), end_time=round(cut_time + self.pad_sec, 3))
        right_seg = SpeechSegment(start_time=round(cut_time - self.pad_sec, 3), end_time=round(seg.end_time, 3))

        # Recursively cut if they are still too long
        self._recursive_cut(left_seg, probs, frame_dur, out_list)
        self._recursive_cut(right_seg, probs, frame_dur, out_list)

    def _hard_split(self, context: VADContext) -> VADContext:
        out = []
        for seg in context.segments:
            curr = seg.start_time
            while curr < seg.end_time:
                nxt = min(seg.end_time, curr + self.max_chunk_sec)
                out.append(SpeechSegment(start_time=round(curr, 3), end_time=round(nxt, 3)))
                curr = nxt
        context.segments = out
        return context
