import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow, getAllWebviewWindows } from "@tauri-apps/api/webviewWindow";
import { Minus, Square, X, Maximize, FileVideo, Command, Settings, PanelRightOpen, PanelRightClose } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { open } from "@tauri-apps/plugin-dialog";
import { useVideoStore } from "../../store/videoStore";
import { useSTTJobStore, selectIsProcessing } from "../../store/sttJobStore";
import { useSTTSettingsStore } from "../../store/sttSettingsStore";
import { useNotifyStore } from "../../store/notifyStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import { STTService } from "../../services/sttService";

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  const { videoUrl, setVideo } = useVideoStore();
  const { isPanelOpen, togglePanel, setPanelOpen, model } = useSTTSettingsStore();
  const isProcessing = useSTTJobStore(selectIsProcessing);
  const { show } = useNotifyStore();

  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };
    checkMaximized();

    const unlisten = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleMinimize = () => appWindow.minimize();
  const handleToggleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const handleOpenVideo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Video",
          extensions: ["mp4", "mkv", "webm"]
        }]
      });

      if (selected && typeof selected === "string") {
        const url = convertFileSrc(selected);
        const fileName = selected.split("\\").pop() || selected.split("/").pop() || "video";
        const file = new File([], fileName);
        setVideo(file, url, selected);
        show("Video loaded successfully", "success");
      }
    } catch (error) {
      console.error("Failed to open video", error);
      show("Failed to open video", "error");
    }
  };

  const handleRunSTT = async () => {
    const path = useVideoStore.getState().videoPath;

    if (!videoUrl || !path) {
      show("Please load a video from the file dialog first", "warning");
      return;
    }

    if (isProcessing) {
      show("STT is already running", "warning");
      return;
    }

    setPanelOpen(true);
    STTService.startSTT(path, model);
  };

  const handleOpenSettings = async () => {
    try {
      const windows = await getAllWebviewWindows();
      const existingWindow = windows.find(w => w.label === "settings");

      if (existingWindow) {
        await existingWindow.setFocus();
      } else {
        const webview = new WebviewWindow("settings", {
          url: "/#/settings",
          title: "Settings",
          width: 600,
          height: 700,
          decorations: false,
          transparent: true,
          resizable: true,
          minWidth: 350,
          minHeight: 500
        });

        webview.once('tauri://error', function (e) {
          console.error("Error creating settings window", e);
          show("Failed to open settings window. Check permissions.", "error");
        });
      }
    } catch (e) {
      console.error("Failed to check windows or create window", e);
      show("Failed to open settings window.", "error");
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-[48px] w-full flex items-center bg-black/60 backdrop-blur-md select-none border-b border-white/5 z-50 absolute top-0 left-0 px-3"
    >
      {/* Left Section (Tools) */}
      <div className="flex items-center gap-1 w-1/3 h-full" data-tauri-drag-region>
        <div className="flex items-center gap-1" data-tauri-drag-region="false" onMouseDown={(e) => e.stopPropagation()}>
          <Tooltip content="Open Video" position="bottom">
            <button
              onClick={handleOpenVideo}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${videoUrl ? "text-[#facc15] hover:bg-white/10" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
            >
              <FileVideo size={16} />
            </button>
          </Tooltip>

          <Tooltip content={isPanelOpen ? "Hide Subtitles" : "Show Subtitles"} position="bottom">
            <button
              onClick={togglePanel}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isPanelOpen ? "text-[#facc15] hover:bg-white/10" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
            >
              {isPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Center Section (Absolute Center STT Button) */}
      <div className="flex items-center justify-center w-1/3 h-full pointer-events-none" data-tauri-drag-region>
        <div className="pointer-events-auto" data-tauri-drag-region="false" onMouseDown={(e) => e.stopPropagation()}>
          <Tooltip content="Run Transcription" position="bottom">
            <button
              onClick={handleRunSTT}
              className="h-7 px-4 flex items-center justify-center gap-2 rounded-full text-[#121212] bg-[#facc15] hover:bg-white transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] font-bold tracking-widest hover:-translate-y-px"
            >
              <Command size={14} />
              <span className="text-[10px] mt-0.5">RUN STT</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Right Section (Settings & Window Controls) */}
      <div className="flex items-center justify-end gap-1 w-1/3 h-full" data-tauri-drag-region>
        <div className="flex items-center gap-1" data-tauri-drag-region="false" onMouseDown={(e) => e.stopPropagation()}>
          <Tooltip content="Settings" position="bottom">
            <button
              onClick={handleOpenSettings}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/10 hover:rotate-90 mr-2"
            >
              <Settings size={16} />
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-white/10 mr-2"></div>

          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all outline-none"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <Minus size={16} />
          </button>

          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all outline-none"
            onClick={handleToggleMaximize}
            aria-label="Maximize"
          >
            {isMaximized ? <Square size={14} /> : <Maximize size={14} />}
          </button>

          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500 hover:text-white text-gray-400 transition-all outline-none"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

    </div>
  );
};

