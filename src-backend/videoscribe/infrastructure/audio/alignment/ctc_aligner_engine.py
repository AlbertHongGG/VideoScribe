import logging
import torch
import torch
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
    Performs global alignment over the entire audio for maximum precision, 
    overriding STT boundaries.
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
        
        # ctc-forced-aligner handles the loading of MMS-300M automatically
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
        # 1. Load Model
        self._load_model_if_needed(options.fa_model)
        report(10.0)

        # 2. Extract and format text from all STT segments, mapping each token back to its segment
        text_split = []
        segment_mapping = []  # maps text_split index to segments index
        
        # Mapping ISO 639-1 (Whisper) to ISO 639-3 (ctc-forced-aligner)
        # MMS-300M supports 100+ languages, here are the most common ones. It falls back to '*' (eng) if not found.
        lang_map = {
            "ja": "jpn", "zh": "chi", "en": "eng", "es": "spa", "fr": "fra", 
            "de": "deu", "ko": "kor", "ru": "rus", "it": "ita", "pt": "por",
            "nl": "nld", "tr": "tur", "pl": "pol", "vi": "vie", "th": "tha",
            "ar": "ara", "hi": "hin", "id": "ind", "ms": "zsm"
        }
        iso_code = lang_map.get(options.language, "eng")

        logger.info(f"Building global text sequence for alignment (Language: {iso_code})...")
        for seg_idx, seg in enumerate(segments):
            text = seg.text
            if not text.strip():
                continue
                
            is_cjk = any(('\u4e00' <= c <= '\u9fff' or '\u3040' <= c <= '\u30ff') for c in text)
            if is_cjk:
                tokens = [c for c in list(text) if c.strip()]
            else:
                tokens = [w for w in text.split() if w.strip()]
                
            for token in tokens:
                text_split.append(token)
                segment_mapping.append(seg_idx)

        if not text_split:
            return segments

        logger.info(f"Normalizing {len(text_split)} tokens...")
        norm_text = [text_normalize(line.strip(), iso_code) for line in text_split]
        tokens = get_uroman_tokens(norm_text, iso_code)

        # Add <star> token to the tokens and text (segment mode)
        tokens_starred = []
        text_starred = []
        for i, token in enumerate(tokens):
            tokens_starred.extend(["<star>", token])
            text_starred.extend(["<star>", text_split[i]])

        report(30.0)
        
        # 3. Load full audio
        logger.info(f"Loading audio waveform for alignment: {audio_path}")
        audio_waveform = load_audio(str(audio_path), self.model.dtype, self.model.device)
        report(40.0)

        # 4. Generate emissions
        logger.info("Generating emissions...")
        batch_size = 16 if self.device == "cuda" else 4
        emissions, stride = generate_emissions(self.model, audio_waveform, batch_size=batch_size)

        # 5. Get alignments
        logger.info("Calculating global alignments...")
        report(80.0)
        aligned_segments, scores, blank_token = get_alignments(emissions, tokens_starred, self.tokenizer)
        report(90.0)

        # 6. Extract spans
        logger.info("Extracting spans...")
        spans = get_spans(tokens_starred, aligned_segments, blank_token)

        # 7. Postprocess results
        logger.info("Postprocessing results to get precise word timestamps...")
        word_timestamps = postprocess_results(text_starred, spans, stride, scores)
        report(95.0)

        # 8. Map back to original TranscriptionSegments
        logger.info("Mapping global timestamps back to STT segments...")
        
        # Group word_timestamps by segment index
        segment_words = {i: [] for i in range(len(segments))}
        
        for i, word_data in enumerate(word_timestamps):
            # word_timestamps corresponds to text_split (excluding <star> tokens)
            seg_idx = segment_mapping[i]
            segment_words[seg_idx].append(Word(
                text=word_data["text"],
                start=word_data["start"],
                end=word_data["end"],
                probability=word_data["score"]
            ))

        aligned_domain_segments = []
        for i, seg in enumerate(segments):
            words = segment_words[i]
            if not words:
                logger.warning(f"No aligned words found for segment '{seg.text}', keeping original.")
                aligned_domain_segments.append(seg)
            else:
                aligned_domain_segments.append(TranscriptionSegment(
                    start=words[0].start,
                    end=words[-1].end,
                    text=seg.text,
                    words=words
                ))

        logger.info("Forced alignment completed successfully.")
        report(100.0)
        return aligned_domain_segments
