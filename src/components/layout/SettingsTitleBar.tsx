import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X, Settings } from "lucide-react";

export const SettingsTitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();

  const handleClose = () => appWindow.close();

  return (
    <div 
      data-tauri-drag-region
      className="h-[48px] w-full flex justify-between items-center bg-black/60 backdrop-blur-md select-none border-b border-white/5 z-50 absolute top-0 left-0 cursor-move"
    >
      <div 
        data-tauri-drag-region
        className="flex items-center pl-4 pr-6 h-full"
      >
        <Settings size={14} className="text-[#facc15] mr-2 pointer-events-none" />
        <span className="text-xs font-bold text-gray-300 tracking-wider pointer-events-none">SETTINGS</span>
      </div>
      
      <div 
        data-tauri-drag-region
        className="flex-1 h-full"
      ></div>

      <div className="flex h-full items-center">
        <div 
          className="h-full w-12 flex items-center justify-center hover:bg-red-500/90 hover:text-white transition-colors cursor-pointer"
          onClick={handleClose}
        >
          <X size={16} className="text-gray-400 hover:text-white pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

