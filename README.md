# VideoScribe

VideoScribe is an AI-powered offline transcription, translation, and audio stem mixing tool for videos. It leverages `faster-whisper` to run Speech-to-Text locally with GPU acceleration, and integrates advanced audio separation models to give you full control over vocals and background music.

## Key Features
- **Local AI Transcription**: High-performance, offline transcription using Faster-Whisper.
- **Audio Stem Separation**: Isolate vocals and background music using state-of-the-art models (MelBandRoformer, MDX-Net).
- **Logarithmic Audio Mixer**: Smooth, studio-grade volume control over individual audio stems.
- **Dual Subtitle Translation**: Local LLM-powered translation and sentence segmentation.
- **Interactive Karaoke Subtitles**: Dynamic word-highlighting and Japanese Furigana/Dictionary support.

---

## Keyboard Shortcuts (Hotkeys)

VideoScribe 配備中央熱鍵排程引擎，提供全域與影片播放控制的快捷操作（在文字輸入框中會自動停用，以防誤觸）：

### 導航與版面 (Navigation & Layout)
| 按鍵 (Shortcut) | 功能 (Action) | 說明 (Description) |
| :--- | :--- | :--- |
| **`P`** / **`p`** | 展開 / 收起右側面板 | 全域快捷鍵（不分大小寫），隨時切換 STT 轉錄與字幕面板 |

### 影片播放與跳轉 (Playback & Seeking)
| 按鍵 (Shortcut) | 功能 (Action) | 說明 (Description) |
| :--- | :--- | :--- |
| **`Arrow Left` (←)** | 快退 5 秒 | 相對向後跳轉 5 秒（支援長按連續觸發） |
| **`Arrow Right` (→)** | 快進 5 秒 | 相對向前跳轉 5 秒（支援長按連續觸發） |
| **`Ctrl + Arrow Left`** | 快退 1 秒 | 精確向後跳轉 1 秒（亦支援 `Cmd + ←`） |
| **`Ctrl + Arrow Right`** | 快進 1 秒 | 精確向前跳轉 1 秒（亦支援 `Cmd + →`） |
| **`Space`** | 播放 / 暫停 | 切換影片播放狀態 |
| **`,`** 或 **`<`** | 逐幀微調倒退 | 長按或連點進行 1/30 秒逐幀連續微調 |
| **`.`** 或 **`>`** | 逐幀微調前進 | 長按或連點進行 1/30 秒逐幀連續微調 |

### 播放速度與顯示 (Speed & Display)
| 按鍵 (Shortcut) | 功能 (Action) | 說明 (Description) |
| :--- | :--- | :--- |
| **`Enter`** | 切換全螢幕 | 進入 / 退出全螢幕模式 |
| **`Esc`** | 退出全螢幕 | 退出當前全螢幕模式 |
| **`A`** / **`a`** | 速度 -0.1x | 降低播放速率（最低 0.1x） |
| **`D`** / **`d`** | 速度 +0.1x | 提高播放速率（最高 16.0x） |
| **`S`** / **`s`** | 1.0x 速度切換 | 重設為原速 1.0x，再次按下切換回前一次速度 |

---

## Portable Build Guide (No Installation Required)

VideoScribe can be packaged into a truly standalone "Portable" directory. This means users do not need to install Python, FFmpeg, or any dependencies on their system. You can simply zip the folder and share it.

### How to Build
1. Close all active development servers (`npm run dev`).
2. Open a PowerShell terminal in the project root.
3. Run the portable build script:
```powershell
.\build_portable.ps1
```

### How the Portable Build Works
We use a **Standalone Python Architecture (uv managed)** instead of PyInstaller. This completely avoids the notorious DLL/C-Extension errors associated with packaging PyTorch and heavy AI models.
- **Tauri App**: Compiled to a standalone `.exe`.
- **Backend Environment**: `uv` automatically fetches a standalone Python 3.11 environment, copies it to `VideoScribe-Portable/backend/python`, and installs all dependencies into it.
- **FFmpeg**: Automatically downloaded and placed in `ffmpeg/bin`.
- **Smart Launch**: The Rust backend automatically detects if `backend/python/python.exe` exists next to it. If it does, it runs in Portable Mode; otherwise, it falls back to Development Mode.

---

## Troubleshooting & Developer Notes

### 1. CUDA / GPU Acceleration Issues
If `faster-whisper` or PyTorch falls back to the CPU, it means your Python environment fetched the CPU-only PyTorch binaries.
**Fix**: We explicitly enforce the CUDA 12.8 wheel in `src-backend/pyproject.toml`. Make sure it contains:
```toml
[tool.uv.sources]
torch = [{ index = "pytorch-cu128" }]

[[tool.uv.index]]
name = "pytorch-cu128"
url = "https://download.pytorch.org/whl/cu128"
explicit = true
```

### 2. Custom API Providers (Tauri Security Blocks)
If you add a custom API (like a local LLM server on `localhost:8000`), Tauri will block the frontend from making requests to it (throwing a `url not allowed on the configured scope` error).
**Fix**: Add the domain to the `http` scope in `src-tauri/capabilities/default.json` and restart the Tauri dev server.
```json
"permissions": [
  {
    "identifier": "http:default",
    "allow": [
      { "url": "http://127.0.0.1:8000/*" },
      { "url": "http://localhost:8000/*" }
    ]
  }
]
```

### 3. State Synchronization (Frontend vs Rust)
**Architecture Rule**: Rust is the Single Source of Truth (SSOT).
If you add new features (e.g., loading new files), you **must** immediately synchronize the state to Rust via IPC (e.g., `invoke("set_video_path")`). Do not hold critical state exclusively in the React frontend (Zustand), as the Rust backend or Python worker will fail to access it during execution.