import sys
import os
import json
import logging
import threading
import queue
from typing import Dict, Any, Optional

# Force UTF-8 for IPC communication on Windows
if sys.platform == "win32":
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    
    import site
    import glob
    for site_pkg in site.getsitepackages():
        nvidia_bins = glob.glob(os.path.join(site_pkg, "nvidia", "*", "bin"))
        for bin_dir in nvidia_bins:
            if os.path.exists(bin_dir):
                os.add_dll_directory(bin_dir)
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")

from videoscribe.domain.cancellation import CancellationToken
from videoscribe.domain.ipc_models import IpcCommand
from videoscribe.infrastructure.handlers import MssHandler, VadHandler, SttHandler, FaHandler, PreprocessHandler

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stderr)]
)

logger = logging.getLogger("worker")

class CommandRouter:
    def __init__(self):
        # Instantiate handlers once to allow caching (e.g., SttHandler caches Whisper model)
        self.handlers = {
            "run_preprocess": PreprocessHandler(),
            "run_mss": MssHandler(),
            "run_vad": VadHandler(),
            "run_stt": SttHandler(),
            "run_fa": FaHandler(),
        }
        self.current_cancel_token: Optional[CancellationToken] = None

    def route(self, cmd: IpcCommand):
        if cmd.action == "cancel":
            self.handle_cancel()
            return
            
        handler = self.handlers.get(cmd.action)
        if not handler:
            logger.warning(f"Unknown command action: {cmd.action}")
            return
            
        job_id = cmd.job_id or "unknown"
        payload = cmd.payload or {}
        self.current_cancel_token = CancellationToken()
        
        try:
            handler.handle(job_id, payload, self.current_cancel_token)
        finally:
            self.current_cancel_token = None

    def handle_cancel(self):
        if self.current_cancel_token:
            logger.info("Cancelling active job...")
            self.current_cancel_token.cancel()
        else:
            logger.info("No active job to cancel.")


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
