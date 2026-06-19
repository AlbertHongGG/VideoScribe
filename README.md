# VideoScribe

VideoScribe is an AI-powered offline transcription and translation tool for videos. It leverages Faster-Whisper to run STT locally with GPU acceleration.

## Building the Portable Application

To build the application into a standalone "Portable" version that requires no Python or FFmpeg installation on the target machine, follow these steps:

1. Close all active development servers (`npm run dev`).
2. Open a PowerShell terminal in the project root.
3. Run the portable build script:
```powershell
.\build_portable.ps1
```
4. The script will automatically compile the frontend, package the Python backend using PyInstaller, download FFmpeg, and assemble everything into a `VideoScribe-Portable` directory.
5. You can now zip the `VideoScribe-Portable` directory and distribute it. Users can simply run `VideoScribe.exe` inside it.

## Troubleshooting / Known Issues

### CUDA / GPU Acceleration Issues (faster-whisper)

**Problem**: 
When running the Speech-to-Text (STT) feature, you might encounter issues where `faster-whisper` falls back to the CPU instead of using the GPU, or fails to find the correct CUDA libraries. By default, package managers might fetch the CPU-only version of PyTorch on Windows.

**Solution**: 
To ensure the backend uses GPU acceleration, the PyTorch CUDA 12.8 wheel index is explicitly defined in `src-backend/pyproject.toml`. When using `uv` to install dependencies, it will fetch the correct GPU-enabled version.

If you are setting this up from scratch or encountering CUDA errors, make sure your `src-backend/pyproject.toml` includes:

```toml
[tool.uv.sources]
torch = [{ index = "pytorch-cu128" }]

[[tool.uv.index]]
name = "pytorch-cu128"
url = "https://download.pytorch.org/whl/cu128"
explicit = true
```

*Note: If you still encounter DLL load errors (e.g., `cublas64_12.dll` not found), ensure that you have the appropriate NVIDIA CUDA 12 toolkit installed on your Windows system and that its `bin` directory is in your system `%PATH%`.*
