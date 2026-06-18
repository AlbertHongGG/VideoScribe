import React from "react";
import { Select } from "../ui/Select";
import { useSTTStore } from "../../store/sttStore";
import { emit, listen } from "@tauri-apps/api/event";

const MODEL_OPTIONS = [
  { value: "tiny", label: "Tiny (Fastest, least accurate)" },
  { value: "base", label: "Base" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium (Balanced)" },
  { value: "large-v3", label: "Large V3 (Slowest, most accurate)" },
];

const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto Detect" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

const TRANSLATION_LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

export const SettingsPanel: React.FC = () => {
  const { 
    model, setModel, 
    language, setLanguage, 
    showSubtitles, setShowSubtitles,
    enableDictionary, setEnableDictionary, 
    enableTranslation, setEnableTranslation, 
    targetLanguage, setTargetLanguage 
  } = useSTTStore();

  return (
    <div className="w-full h-full p-8 text-white overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto pt-4">
        <div className="space-y-8">
          {/* AI Engine Section */}
          <section className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-sm hover:border-white/10 transition-colors">
            <h3 className="text-sm font-bold tracking-widest text-gray-200 uppercase mb-6 flex items-center gap-2">
              <div className="w-1 h-3.5 bg-[#facc15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
              Speech-to-Text Engine
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center">
                <label className="text-sm font-medium text-gray-300">Model Size</label>
                <div className="md:col-span-2">
                  <Select options={MODEL_OPTIONS} value={model} onChange={async (val) => {
                    setModel(val);
                    await emit("setting-changed", { key: "model", value: val });
                  }} />
                </div>
              </div>

              <div className="h-px bg-white/5 w-full"></div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center">
                <label className="text-sm font-medium text-gray-300">Language Detection</label>
                <div className="md:col-span-2">
                  <Select options={LANGUAGE_OPTIONS} value={language || "auto"} onChange={async (val) => {
                    setLanguage(val);
                    await emit("setting-changed", { key: "language", value: val });
                  }} />
                </div>
              </div>
            </div>
          </section>

          {/* Display Section */}
          <section className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-sm hover:border-white/10 transition-colors">
            <h3 className="text-sm font-bold tracking-widest text-gray-200 uppercase mb-6 flex items-center gap-2">
              <div className="w-1 h-3.5 bg-[#facc15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
              Display
            </h3>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Subtitle Overlay</label>
                <p className="text-xs text-gray-500 mt-1">Show generated subtitles directly on the video player</p>
              </div>
              
              <button 
                onClick={async () => {
                  const newValue = !showSubtitles;
                  setShowSubtitles(newValue);
                  await emit("setting-changed", { key: "showSubtitles", value: newValue });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${showSubtitles ? 'bg-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showSubtitles ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="h-px bg-white/5 w-full my-6"></div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Japanese Dictionary Hover</label>
                <p className="text-xs text-gray-500 mt-1">Hover over Japanese subtitles to see readings and definitions</p>
              </div>
              
              <button 
                onClick={async () => {
                  const newValue = !enableDictionary;
                  setEnableDictionary(newValue);
                  await emit("setting-changed", { key: "enableDictionary", value: newValue });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${enableDictionary ? 'bg-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableDictionary ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </section>

          {/* AI Translation Section */}
          <section className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-sm hover:border-white/10 transition-colors">
            <h3 className="text-sm font-bold tracking-widest text-gray-200 uppercase mb-6 flex items-center gap-2">
              <div className="w-1 h-3.5 bg-[#facc15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
              Dual Subtitle Translation
            </h3>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <label className="text-sm font-medium text-gray-300">Enable Translation</label>
                <p className="text-xs text-gray-500 mt-1">Automatically translate generated subtitles using local LLM</p>
              </div>
              
              <button 
                onClick={async () => {
                  const newValue = !enableTranslation;
                  setEnableTranslation(newValue);
                  await emit("setting-changed", { key: "enableTranslation", value: newValue });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${enableTranslation ? 'bg-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableTranslation ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="h-px bg-white/5 w-full my-6"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center">
              <label className="text-sm font-medium text-gray-300">Target Language</label>
              <div className="md:col-span-2">
                <Select 
                  options={TRANSLATION_LANGUAGES} 
                  value={targetLanguage} 
                  onChange={async (val) => {
                    setTargetLanguage(val);
                    await emit("setting-changed", { key: "targetLanguage", value: val });
                  }} 
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

