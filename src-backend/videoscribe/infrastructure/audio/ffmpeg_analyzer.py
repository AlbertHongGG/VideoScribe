import subprocess
import logging
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
        
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
        if result.returncode != 0:
            logger.error(f"Failed to get duration: {result.stderr}")
            return 0.0
            
        try:
            return float(result.stdout.strip())
        except ValueError:
            return 0.0
