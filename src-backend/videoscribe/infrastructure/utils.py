import os
import sys
import gc
import logging

def get_project_root() -> str:
    """
    Get the absolute path to the project root directory.
    When running in development, this is typically the src-backend directory or the root.
    When running as a PyInstaller executable, sys._MEIPASS or executable directory applies.
    """
    if getattr(sys, 'frozen', False):
        # Running as compiled PyInstaller executable
        return os.path.dirname(sys.executable)
    
    # In development, assuming this file is under src-backend/videoscribe/infrastructure/
    # Go up 3 levels to reach src-backend
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))

def get_tmp_dir() -> str:
    """
    Get the path to the centralized temporary directory (.runtime/tmp) and ensure it exists.
    """
    root = get_project_root()
    tmp_dir = os.path.join(root, ".runtime", "tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    return tmp_dir

def get_or_create_workspace(input_path: str) -> str:
    """
    Returns the workspace directory for the current pipeline run.
    If the input_path is already inside the tmp_dir, it uses its parent directory.
    Otherwise, it creates a new timestamped folder inside tmp_dir.
    """
    from datetime import datetime
    tmp_dir = get_tmp_dir()
    
    # Check if input is already in tmp_dir
    abs_input = os.path.abspath(input_path)
    if abs_input.startswith(os.path.abspath(tmp_dir)):
        return os.path.dirname(abs_input)
        
    # Generate new workspace
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = os.path.splitext(os.path.basename(input_path))[0]
    safe_name = "".join([c if c.isalnum() else "_" for c in file_name])
    folder_name = f"{timestamp}_{safe_name}"
    
    workspace_dir = os.path.join(tmp_dir, folder_name)
    os.makedirs(workspace_dir, exist_ok=True)
    return workspace_dir


_device = None

def get_device() -> str:
    """
    Lazily determine and cache the compute device (cuda or cpu).
    This prevents importing torch at the top level and multiple evaluations.
    """
    global _device
    if _device is None:
        try:
            import torch
            _device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            _device = "cpu"
    return _device

def get_ai_audio_path(master_audio_path: str) -> str:
    """
    Convention over Configuration: Check if a 16kHz AI-optimized track exists.
    Returns the path to the 16k version if it exists, otherwise falls back to the original.
    """
    if not master_audio_path:
        return master_audio_path
        
    ai_path = master_audio_path.replace(".wav", "_16k.wav")
    return ai_path if os.path.exists(ai_path) else master_audio_path

def clean_memory():
    """
    Forces Python garbage collection and thoroughly empties PyTorch CUDA caches.
    This is critical for ensuring models are physically removed from VRAM.
    """
    logger = logging.getLogger("utils.clean_memory")
    
    # Force Python GC to collect unreferenced objects (like detached models)
    collected = gc.collect()
    
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
            logger.info(f"Memory cleaned: {collected} objects collected, CUDA cache emptied.")
        else:
            logger.info(f"Memory cleaned: {collected} objects collected (CPU).")
    except ImportError:
        logger.info(f"Memory cleaned: {collected} objects collected (Torch not available).")
