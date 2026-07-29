import subprocess
import logging
import os
from videoscribe.domain.interfaces import AudioAnalyzer

logger = logging.getLogger(__name__)

class FFmpegAudioAnalyzer(AudioAnalyzer):
    def get_duration(self, audio_path: str) -> float:
        command = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path
        ]
        
        result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            logger.error(f"Failed to get duration: {result.stderr}")
            return 0.0
            
        try:
            return float(result.stdout.strip())
        except ValueError:
            return 0.0

    def extract_audio(self, video_path: str, output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        out_path = os.path.join(output_dir, "extracted_audio.wav")
        out_16k_path = os.path.join(output_dir, "extracted_audio_16k.wav")
        command = [
            "ffmpeg", "-y",
            "-i", video_path,
            
            # 1. High fidelity master track (for UI and MSS)
            "-map", "0:a:0",
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "44100",
            "-ac", "2",
            out_path,
            
            # 2. AI optimized track (for Whisper, VAD, FA)
            "-map", "0:a:0",
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            out_16k_path
        ]
        result = subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            logger.error(f"Failed to extract audio: {result.stderr}")
            raise RuntimeError(f"FFmpeg audio extraction failed: {result.stderr}")
        return out_path
