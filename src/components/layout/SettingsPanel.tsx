import React from "react";
import { ChevronDown } from "lucide-react";

export const SettingsPanel: React.FC = () => {
  return (
    <div className="w-full h-full p-8 pt-16 text-white overflow-y-auto custom-scrollbar bg-gradient-to-br from-[#121212]/90 to-black backdrop-blur-md">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-white tracking-tight flex items-center gap-3">
          <span className="w-2 h-8 bg-[#facc15] rounded-full shadow-[0_0_15px_rgba(250,204,21,0.6)]"></span>
          Settings
        </h2>
        
        <div className="space-y-8 pb-12">
          <section className="space-y-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <h3 className="text-lg font-semibold text-gray-200 border-b border-white/10 pb-4 flex items-center gap-2">
              Speech-to-Text Engine
            </h3>
            
            <div className="flex flex-col gap-3 relative z-10">
              <label className="text-sm text-gray-400 font-bold tracking-wider uppercase">Model Size</label>
              <div className="relative">
                <select className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-[#facc15] focus:ring-1 focus:ring-[#facc15]/50 transition-all cursor-pointer appearance-none hover:bg-black/80 font-medium">
                  <option value="tiny">Tiny (Fastest, least accurate)</option>
                  <option value="base">Base</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium (Balanced)</option>
                  <option value="large-v3">Large V3 (Slowest, most accurate)</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed pl-1">Larger models require more RAM and take longer to process, but yield significantly better results.</p>
            </div>

            <div className="flex flex-col gap-3 pt-4 relative z-10">
              <label className="text-sm text-gray-400 font-bold tracking-wider uppercase">Language Detection</label>
              <div className="relative">
                <select className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:border-[#facc15] focus:ring-1 focus:ring-[#facc15]/50 transition-all cursor-pointer appearance-none hover:bg-black/80 font-medium">
                  <option value="auto">Auto Detect</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="zh">Chinese</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed pl-1">Manually setting the language can improve accuracy if auto-detect fails or struggles with accents.</p>
            </div>
          </section>

          <section className="space-y-6 bg-white/[0.02] p-8 rounded-3xl border border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <h3 className="text-lg font-semibold text-gray-200 border-b border-white/10 pb-4 flex items-center gap-2">
              Display
            </h3>
            
            <div className="flex items-center justify-between p-4 -mx-4 hover:bg-white/5 rounded-2xl transition-colors cursor-pointer group/item relative z-10">
              <div>
                <label className="text-base text-gray-200 font-medium cursor-pointer group-hover/item:text-white transition-colors">Subtitle Overlay</label>
                <p className="text-sm text-gray-500 mt-1.5">Show generated subtitles directly on the video player</p>
              </div>
              
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-12 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#facc15] peer-checked:after:bg-black peer-checked:shadow-[0_0_15px_rgba(250,204,21,0.4)]"></div>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

