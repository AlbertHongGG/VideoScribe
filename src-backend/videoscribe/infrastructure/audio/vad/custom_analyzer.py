from typing import Iterator, Optional
from videoscribe.domain.interfaces import VADAnalyzer
from videoscribe.domain.models import AudioWindow
from videoscribe.domain.transcription_options import TranscriptionOptions
import logging

try:
    from faster_whisper.vad import get_speech_timestamps, VadOptions
    from faster_whisper.audio import decode_audio
    HAS_FASTER_WHISPER = True
except ImportError:
    HAS_FASTER_WHISPER = False

logger = logging.getLogger(__name__)

class CustomVADAnalyzer(VADAnalyzer):
    """
    A custom VAD analyzer implementation using Silero VAD (bundled with faster-whisper).
    Processes the audio and returns explicit speech segments.
    """
    
    def analyze(self, audio_path: str, options: TranscriptionOptions) -> Optional[Iterator[AudioWindow]]:
        if not HAS_FASTER_WHISPER:
            logger.error("faster_whisper is not installed. CustomVADAnalyzer cannot run.")
            return None
            
        logger.info(f"CustomVADAnalyzer: Running Silero VAD on {audio_path}")
        
        # Decode audio to 16kHz mono which Silero VAD requires
        # faster-whisper's decode_audio defaults to 16000Hz sampling rate
        audio = decode_audio(audio_path, sampling_rate=16000)
        
        # We can expose VadOptions through TranscriptionOptions if needed,
        # but for now we use the default recommended parameters.
        vad_parameters = VadOptions(
            max_speech_duration_s=options.batch_size if options.use_batch else 30.0,
            min_silence_duration_ms=160,
        )
        
        speech_chunks = get_speech_timestamps(audio, vad_parameters)
        
        def generator():
            for chunk in speech_chunks:
                # speech_chunks contains dicts with 'start' and 'end' in samples (not seconds)
                # Wait, faster_whisper.vad.get_speech_timestamps returns dicts with 'start' and 'end' in samples!
                # Because we decoded at 16000Hz, we convert them to seconds.
                start_sec = chunk['start'] / 16000.0
                end_sec = chunk['end'] / 16000.0
                yield AudioWindow(start=start_sec, end=end_sec)
                
        return generator()
