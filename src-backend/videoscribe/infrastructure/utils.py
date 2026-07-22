import os
import sys

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
