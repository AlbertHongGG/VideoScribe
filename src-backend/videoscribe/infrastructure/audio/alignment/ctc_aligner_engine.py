import logging
import torch
import numpy as np
from typing import List, Callable, Optional

from ctc_forced_aligner import (
    load_audio,
    load_alignment_model,
    generate_emissions,
    get_alignments,
    get_spans,
    postprocess_results,
)
from ctc_forced_aligner.text_utils import text_normalize, get_uroman_tokens

from videoscribe.domain.interfaces import ForcedAlignmentAnalyzer
from videoscribe.domain.models import TranscriptionSegment, Word
from videoscribe.domain.transcription_options import TranscriptionOptions

logger = logging.getLogger(__name__)

class CTCAlignerEngine(ForcedAlignmentAnalyzer):
    """
    Engine handling Meta MMS-300M forced alignment logic using ctc-forced-aligner.
    Performs Overlapping Super-Segment Chunking (Overlap-Add) over pre-computed global emissions 
    for maximum precision, preventing OOM on long audio while completely eliminating boundary truncation effects.
    """
    def __init__(self):
        self.current_model_name = None
        self.model = None
        self.tokenizer = None
        
        if not torch.cuda.is_available():
            logger.warning("CUDA is not available! Falling back to CPU. Performance will be degraded.")
            self.device = "cpu"
            self.dtype = torch.float32
        else:
            self.device = "cuda"
            self.dtype = torch.float16

    def _load_model_if_needed(self, model_name: str):
        if self.current_model_name == model_name and self.model is not None:
            return

        logger.info(f"Loading alignment model: {model_name} on {self.device}...")
        self.model, self.tokenizer = load_alignment_model(
            self.device,
            dtype=self.dtype
        )
        self.current_model_name = model_name
        logger.info("Alignment model loaded successfully.")

    def align(self, audio_path: str, segments: List[TranscriptionSegment], options: TranscriptionOptions, progress_callback: Optional[Callable[[float], None]] = None) -> List[TranscriptionSegment]:
        def report(pct: float):
            if progress_callback:
                progress_callback(pct)

        if not segments:
            logger.info("No segments provided for forced alignment. Returning empty list.")
            report(100.0)
            return segments

        report(5.0)
        self._load_model_if_needed(options.fa_model)
        report(10.0)

        # Map language
        lang_map = {
            "ja": "jpn", "zh": "chi", "en": "eng", "es": "spa", "fr": "fra", 
            "de": "deu", "ko": "kor", "ru": "rus", "it": "ita", "pt": "por",
            "nl": "nld", "tr": "tur", "pl": "pol", "vi": "vie", "th": "tha",
            "ar": "ara", "hi": "hin", "id": "ind", "ms": "zsm"
        }
        iso_code = lang_map.get(options.language, "eng")
        
        # 1. Load full audio
        logger.info(f"Loading audio waveform for alignment: {audio_path}")
        audio_waveform = load_audio(str(audio_path), self.model.dtype, self.model.device)
        total_audio_sec = audio_waveform.shape[0] / 16000.0
        report(20.0)

        # 2. Generate global emissions (O(1) Memory, done in batches)
        logger.info("Generating global emissions (batched)...")
        batch_size = 16 if self.device == "cuda" else 4
        emissions, stride = generate_emissions(self.model, audio_waveform, batch_size=batch_size)
        
        # stride is in milliseconds (e.g. 20.0 ms per frame)
        frames_per_second = 1000.0 / stride
        total_frames = emissions.shape[0]
        
        report(40.0)
        logger.info(f"Global emissions generated: {total_frames} frames ({total_audio_sec:.2f}s). Starting overlapping chunk alignments...")

        total_segments = len(segments)
        aligned_domain_segments = [None] * total_segments
        
        chunk_size = 20
        step = 10
        
        # 3. Overlapping Super-Segment Chunking
        for chunk_idx in range(0, total_segments, step):
            chunk_segs_indices = list(range(chunk_idx, min(chunk_idx + chunk_size, total_segments)))
            if not chunk_segs_indices:
                break
                
            first_idx = chunk_segs_indices[0]
            last_idx = chunk_segs_indices[-1]
            
            # Determine keep range to discard edge effects
            keep_start_idx = first_idx if first_idx == 0 else first_idx + (chunk_size - step) // 2
            keep_end_idx = last_idx if last_idx == total_segments - 1 else first_idx + step + (chunk_size - step) // 2 - 1
            
            chunk_segments = [segments[i] for i in chunk_segs_indices]
            
            # Generous physical padding (±10s) to ensure audio borders don't cut off speech
            search_start_sec = max(0.0, chunk_segments[0].start - 10.0)
            search_end_sec = min(total_audio_sec, chunk_segments[-1].end + 10.0)
            
            if search_end_sec <= search_start_sec:
                search_end_sec = min(total_audio_sec, search_start_sec + 5.0)
                
            start_frame = max(0, int(search_start_sec * frames_per_second))
            end_frame = min(total_frames, int(search_end_sec * frames_per_second))
            
            # Slice emissions for this chunk
            local_emissions = emissions[start_frame:end_frame, :]
            
            text_split = []
            segment_mapping = []
            
            # Accumulate full text for this chunk to prevent hallucinations
            for i, seg in enumerate(chunk_segments):
                text = seg.text
                if not text.strip():
                    continue
                
                is_cjk = any(('\u4e00' <= c <= '\u9fff' or '\u3040' <= c <= '\u30ff') for c in text)
                if is_cjk:
                    words = [c for c in list(text) if c.strip()]
                else:
                    words = [w for w in text.split() if w.strip()]
                    
                for w in words:
                    text_split.append(w)
                    segment_mapping.append(chunk_segs_indices[i])
                    
            if not text_split:
                for global_seg_idx in range(keep_start_idx, keep_end_idx + 1):
                    if aligned_domain_segments[global_seg_idx] is None:
                        aligned_domain_segments[global_seg_idx] = segments[global_seg_idx]
                continue
                
            norm_text = [text_normalize(line.strip(), iso_code) for line in text_split]
            tokens = get_uroman_tokens(norm_text, iso_code)

            tokens_starred = []
            text_starred = []
            for i, token in enumerate(tokens):
                tokens_starred.extend(["<star>", token])
                text_starred.extend(["<star>", text_split[i]])
                
            try:
                aligned_segments_res, scores, blank_token = get_alignments(local_emissions, tokens_starred, self.tokenizer)
                spans = get_spans(tokens_starred, aligned_segments_res, blank_token)
                word_timestamps = postprocess_results(text_starred, spans, stride, scores)
                
                # Group words by global segment index
                seg_words = {idx: [] for idx in chunk_segs_indices}
                for i, w in enumerate(word_timestamps):
                    global_seg_idx = segment_mapping[i]
                    abs_start = search_start_sec + w["start"]
                    abs_end = search_start_sec + w["end"]
                    seg_words[global_seg_idx].append(Word(
                        text=w["text"],
                        start=abs_start,
                        end=abs_end,
                        probability=w["score"]
                    ))
                    
                # Assign to final list ONLY if within keep_range (safe zone)
                for global_seg_idx in range(keep_start_idx, keep_end_idx + 1):
                    words = seg_words[global_seg_idx]
                    original_seg = segments[global_seg_idx]
                    if words:
                        aligned_domain_segments[global_seg_idx] = TranscriptionSegment(
                            start=words[0].start,
                            end=words[-1].end,
                            text=original_seg.text,
                            words=words
                        )
                    else:
                        aligned_domain_segments[global_seg_idx] = original_seg
                        
            except Exception as e:
                logger.warning(f"Failed to align chunk [{first_idx}-{last_idx}]: {e}. Falling back to original timestamps.")
                for global_seg_idx in range(keep_start_idx, keep_end_idx + 1):
                    if aligned_domain_segments[global_seg_idx] is None:
                        aligned_domain_segments[global_seg_idx] = segments[global_seg_idx]
                        
            # Report progress
            prog = 40.0 + (55.0 * (chunk_idx + step) / total_segments)
            report(min(95.0, prog))

        # Fill any missing segments due to edge cases
        for i in range(total_segments):
            if aligned_domain_segments[i] is None:
                aligned_domain_segments[i] = segments[i]

        logger.info("Forced alignment completed successfully. Cleaning up memory...")
        
        # 4. Aggressive memory cleanup
        del emissions
        del audio_waveform
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        report(100.0)
        return aligned_domain_segments
