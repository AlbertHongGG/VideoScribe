import sys
import os
import json
import logging
import threading
import queue
from typing import Dict, Any, Optional
import torch

# Force UTF-8 for IPC communication on Windows
if sys.platform == "win32":
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    
    # Add CUDA 12 DLL paths for ctranslate2 (used by faster-whisper)
    # PyTorch cu130 does not provide CUDA 12 DLLs, so we must add the ones from nvidia-*-cu12
    import site
    import glob
    for site_pkg in site.getsitepackages():
        nvidia_bins = glob.glob(os.path.join(site_pkg, "nvidia", "*", "bin"))
        for bin_dir in nvidia_bins:
            if os.path.exists(bin_dir):
                os.add_dll_directory(bin_dir)
                # Also append to PATH because ctranslate2's C++ core might use standard LoadLibrary
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")

from videoscribe.infrastructure.recognizers.faster_whisper_engine import FasterWhisperEngine
from videoscribe.application.transcription_job import TranscriptionJob
from videoscribe.infrastructure.audio.ffmpeg_analyzer import FFmpegAudioAnalyzer
from videoscribe.infrastructure.reporters.ipc_reporter import IpcReporter
from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import IpcCommand, StartPayload
from videoscribe.domain.transcription_options import TranscriptionOptions, VADEngineType, MSSEngineType
from videoscribe.domain.prompt_registry import PromptRegistry

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)] # Log to stderr, stdout is reserved for NDJSON
)

logger = logging.getLogger("worker")

class CommandRouter:
    def __init__(self):
        self.analyzer = FFmpegAudioAnalyzer()
        self.recognizer = FasterWhisperEngine()
        self.current_cancel_token: Optional[CancellationToken] = None

    def route(self, cmd: IpcCommand):
        if cmd.action == "start":
            self.handle_start(cmd.job_id or "unknown", cmd.payload or {})
        elif cmd.action == "cancel":
            self.handle_cancel()
        else:
            logger.warning(f"Unknown command action: {cmd.action}")

    def handle_cancel(self):
        if self.current_cancel_token:
            logger.info("Cancelling active job...")
            self.current_cancel_token.cancel()
        else:
            logger.info("No active job to cancel.")

    def handle_start(self, job_id: str, payload_data: Dict[str, Any]):
        try:
            payload = StartPayload(**payload_data)
        except TypeError as e:
            reporter = IpcReporter(job_id)
            reporter.report_error(f"Invalid payload: {e}")
            return
            
        reporter = IpcReporter(job_id)
        
        if not payload.video_path:
            reporter.report_error("video_path is required")
            return

        # Orchestrator Decisions: Auto-detect optimal device and compute_type
        is_gpu = torch.cuda.is_available()
        device = "cuda" if is_gpu else "cpu"
        
        # FasterWhisper CPU recommends int8. GPU uses int8_float16.
        compute_type = "int8_float16" if is_gpu else "int8"
        
        # Orchestrator Decisions: Batching
        # Only allow batching if the user requested it AND we have a GPU
        use_batch = payload.use_batch and is_gpu
        
        reporter.report_initial_state(device, compute_type, payload.language)
        
        vad_engine_enum = VADEngineType(payload.vad_engine) if payload.vad_engine in ["off", "native", "silero", "silero_v6"] else VADEngineType.OFF
        
        mss_engine_enum = MSSEngineType(payload.mss_engine) if payload.mss_engine in ["off", "audio_separator"] else MSSEngineType.OFF

        # Build options
        options = TranscriptionOptions(
            model_size=payload.model,
            device=device,
            compute_type=compute_type,
            language=payload.language,
            vad_engine=vad_engine_enum,
            mss_engine=mss_engine_enum,
            mss_model=payload.mss_model,
            use_batch=use_batch,
            batch_size=payload.batch_size,
            initial_prompt=PromptRegistry.get_prompt(payload.language)
        )
        
        self.current_cancel_token = CancellationToken()
        job = TranscriptionJob(self.analyzer, self.recognizer, reporter)
        
        try:
            job.run(
                audio_path=payload.video_path,
                options=options,
                cancel_token=self.current_cancel_token
            )
        except Exception as e:
            reporter.report_error(str(e))
        finally:
            self.current_cancel_token = None

class SttDaemon:
    def __init__(self):
        self.cmd_queue = queue.Queue()
        self.router = CommandRouter()

    def _listen_stdin(self):
        logger.info("Stdin listener thread started.")
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                cmd = IpcCommand.from_dict(data)
                
                if cmd.action == "cancel":
                    # Fast-path for cancel: process immediately in listener thread
                    logger.info("Cancel command received in listener thread.")
                    self.router.handle_cancel()
                else:
                    self.cmd_queue.put(cmd)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {line}")
        logger.info("Stdin closed. Exiting.")
        self.cmd_queue.put(IpcCommand(action="quit"))

    def run(self):
        logger.info("STT Daemon started.")
        
        listener_thread = threading.Thread(target=self._listen_stdin, daemon=True)
        listener_thread.start()

        while True:
            try:
                cmd = self.cmd_queue.get(timeout=1.0)
            except queue.Empty:
                continue
                
            if cmd.action == "quit":
                break
            
            self.router.route(cmd)

if __name__ == "__main__":
    daemon = SttDaemon()
    daemon.run()
