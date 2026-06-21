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

## Adding a Custom AI Provider

If you want to integrate your own custom AI Provider (like a local LLM server or a third-party API) into the translation system, you will need to follow these steps:

1. **Implement the SDK and Provider Interface**: 
   Create a new directory for your provider under `src/multiagent/providers/`. Implement your API client and create a Provider class that implements the `AIProvider` interface.
   
2. **Register in ProviderFactory**: 
   Update `src/multiagent/providers/ProviderFactory.ts` to include your new provider in the `switch` statement and read any necessary configuration from environment variables.

3. **Update Environment Variables**: 
   Add your provider's configuration options to both `.env.example` and your local `.env` file. Change `VITE_AGENT_TRANSLATOR_PROVIDER` to your new provider's name to use it.

4. **Configure Tauri Security Capabilities (Crucial)**: 
   Tauri has strict security policies for frontend network requests. If your custom API endpoint is not explicitly allowed, Tauri will block the request and throw a `url not allowed on the configured scope` error. 
   
   To fix this, you must add your API endpoint's URL or domain to the allowed `http` scope in `src-tauri/capabilities/default.json`. For example, if your local server runs on port 8000:
   
   ```json
   "permissions": [
     // ... other permissions
     {
       "identifier": "http:default",
       "allow": [
         { "url": "http://127.0.0.1:8000/*" },
         { "url": "http://localhost:8000/*" }
         // Add your custom API domains here
       ]
     }
   ]
   ```
   *Note: After modifying `capabilities/default.json`, you must restart the Tauri development server (`npm run dev`) for the changes to take effect.*
