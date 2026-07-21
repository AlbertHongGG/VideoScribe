import { Select } from "../ui/Select";
import { Slider } from "../ui/Slider";
import { useSTTSettingsStore } from "../../store/sttSettingsStore";
import { emit } from "@tauri-apps/api/event";

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
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const VAD_ENGINE_OPTIONS = [
  { value: "off", label: "Off (No VAD)" },
  { value: "native", label: "Native (Whisper Built-in)" },
  { value: "custom", label: "Custom (Silero VAD Plugin)" }
];

export const SettingsPanel: React.FC = () => {
  const { 
    model, setModel, 
    language, setLanguage, 
    vadEngine, setVadEngine,
    useBatch, setUseBatch,
    batchSize, setBatchSize,
    showSubtitles, setShowSubtitles,
    enableDictionary, setEnableDictionary, 
    enableFurigana, setEnableFurigana,
    enableTranslation, setEnableTranslation, 
    targetLanguage, setTargetLanguage,
    subtitlePositionX, setSubtitlePositionX,
    subtitlePositionY, setSubtitlePositionY,
    subtitleSpacing, setSubtitleSpacing,
    sttFontSize, setSttFontSize,
    translationFontSize, setTranslationFontSize
  } = useSTTSettingsStore();

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

          {/* Performance & Pipeline Section */}
          <section className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-sm hover:border-white/10 transition-colors">
            <h3 className="text-sm font-bold tracking-widest text-gray-200 uppercase mb-6 flex items-center gap-2">
              <div className="w-1 h-3.5 bg-[#facc15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
              Performance & Pipeline
            </h3>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Use Batch Processing</label>
                <p className="text-xs text-gray-500 mt-1">Dramatically speeds up transcription by processing multiple audio segments at once.</p>
              </div>
              
              <button 
                onClick={async () => {
                  const newValue = !useBatch;
                  setUseBatch(newValue);
                  await emit("setting-changed", { key: "useBatch", value: newValue });
                  if (newValue && vadEngine === 'off') {
                    setVadEngine('native');
                    await emit("setting-changed", { key: "vadEngine", value: 'native' });
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${useBatch ? 'bg-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useBatch ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="h-px bg-white/5 w-full my-6"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:items-center">
              <div>
                <label className="text-sm font-medium text-gray-300">Voice Activity Detection Engine</label>
                <p className="text-xs text-gray-500 mt-1">
                  Filter out silence. {useBatch && "(Required for Batch Processing)"}
                </p>
              </div>
              <div className="md:col-span-2">
                <Select 
                  options={useBatch ? VAD_ENGINE_OPTIONS.filter(o => o.value !== 'off') : VAD_ENGINE_OPTIONS} 
                  value={vadEngine} 
                  onChange={async (val) => {
                    setVadEngine(val);
                    await emit("setting-changed", { key: "vadEngine", value: val });
                  }} 
                />
              </div>
            </div>

            {useBatch && (
              <>
                <div className="h-px bg-white/5 w-full my-6"></div>
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Batch Settings</h4>
                  <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
                    <Slider 
                      label="Batch Size" 
                      value={batchSize} 
                      min={1} max={64} 
                      unit=""
                      onChange={async (val) => {
                        setBatchSize(val);
                        await emit("setting-changed", { key: "batchSize", value: val });
                      }} 
                    />
                  </div>
                </div>
              </>
            )}
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

            <div className="h-px bg-white/5 w-full my-6"></div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Japanese Furigana</label>
                <p className="text-xs text-gray-500 mt-1">Show Hiragana readings above Kanji in Japanese subtitles</p>
              </div>
              
              <button 
                onClick={async () => {
                  const newValue = !enableFurigana;
                  setEnableFurigana(newValue);
                  await emit("setting-changed", { key: "enableFurigana", value: newValue });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none ${enableFurigana ? 'bg-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableFurigana ? 'translate-x-6' : 'translate-x-1'}`} />
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

          {/* Subtitle Appearance & Layout Section */}
          <section className="bg-[#141414] border border-white/5 rounded-2xl p-6 shadow-sm hover:border-white/10 transition-colors">
            <h3 className="text-sm font-bold tracking-widest text-gray-200 uppercase mb-6 flex items-center gap-2">
              <div className="w-1 h-3.5 bg-[#facc15] rounded-full shadow-[0_0_8px_rgba(250,204,21,0.5)]"></div>
              Subtitle Appearance & Layout
            </h3>
            
            <div className="space-y-8">
              {/* Positioning Group */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Positioning</h4>
                <div className="space-y-6 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                  <Slider 
                    label="Horizontal Position (X)" 
                    value={subtitlePositionX} 
                    min={0} max={100} 
                    unit="%"
                    onChange={async (val) => {
                      setSubtitlePositionX(val);
                      await emit("setting-changed", { key: "subtitlePositionX", value: val });
                    }} 
                  />
                  <Slider 
                    label="Vertical Position (Y)" 
                    value={subtitlePositionY} 
                    min={0} max={100} 
                    unit="%"
                    onChange={async (val) => {
                      setSubtitlePositionY(val);
                      await emit("setting-changed", { key: "subtitlePositionY", value: val });
                    }} 
                  />
                </div>
              </div>

              {/* Typography Group */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Typography & Spacing</h4>
                <div className="space-y-6 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                  <Slider 
                    label="Main Subtitle Size" 
                    value={sttFontSize} 
                    min={12} max={48} 
                    unit="px"
                    onChange={async (val) => {
                      setSttFontSize(val);
                      await emit("setting-changed", { key: "sttFontSize", value: val });
                    }} 
                  />
                  <Slider 
                    label="Translation Size" 
                    value={translationFontSize} 
                    min={12} max={48} 
                    unit="px"
                    onChange={async (val) => {
                      setTranslationFontSize(val);
                      await emit("setting-changed", { key: "translationFontSize", value: val });
                    }} 
                  />
                  <Slider 
                    label="Dual Subtitle Spacing" 
                    value={subtitleSpacing} 
                    min={0} max={40} 
                    unit="px"
                    onChange={async (val) => {
                      setSubtitleSpacing(val);
                      await emit("setting-changed", { key: "subtitleSpacing", value: val });
                    }} 
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

