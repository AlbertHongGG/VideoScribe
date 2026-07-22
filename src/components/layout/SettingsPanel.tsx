import { useSTTSettingsStore } from "../../store/sttSettingsStore";
import { emit } from "@tauri-apps/api/event";
import { SettingSection } from "../settings/SettingSection";
import { SettingRow, SettingDivider, SettingGroup } from "../settings/SettingRow";
import { SettingSelect, SettingToggle, SettingSlider } from "../settings/SettingControls";

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

const VAD_ENGINE_OPTIONS = [
  { value: "off", label: "Off (No VAD)" },
  { value: "native", label: "Native (Whisper Built-in)" },
  { value: "silero", label: "Silero VAD Plugin" }
];

const MSS_ENGINE_OPTIONS = [
  { value: "off", label: "Off (No MSS)" },
  { value: "audio_separator", label: "Audio-Separator" }
];

const MSS_MODEL_OPTIONS = [
  { value: "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt", label: "MelBandRoformer (High Quality)" },
  { value: "model_bs_roformer_ep_317_sdr_12.9755.ckpt", label: "BSRoformer" },
  { value: "UVR-MDX-NET-Inst_HQ_3.onnx", label: "MDX-Net (Fast)" }
];

export const SettingsPanel: React.FC = () => {
  const store = useSTTSettingsStore();

  return (
    <div className="w-full h-full p-8 text-white overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto pt-4">
        <div className="space-y-8">
          
          <SettingSection title="Speech-to-Text Engine">
            <SettingRow label="Model Size" layout="grid">
              <SettingSelect settingKey="model" value={store.model} options={MODEL_OPTIONS} setter={store.setModel} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Language Detection" layout="grid">
              <SettingSelect settingKey="language" value={store.language || "auto"} options={LANGUAGE_OPTIONS} setter={store.setLanguage} />
            </SettingRow>
          </SettingSection>

          <SettingSection title="Performance & Pipeline">
            <SettingRow label="Voice Activity Detection Engine" description={`Filter out silence. ${store.useBatch ? "(Required for Batch Processing)" : ""}`} layout="grid">
              <SettingSelect 
                settingKey="vadEngine" 
                value={store.vadEngine} 
                options={store.useBatch ? VAD_ENGINE_OPTIONS.filter(o => o.value !== 'off') : VAD_ENGINE_OPTIONS} 
                setter={store.setVadEngine} 
              />
            </SettingRow>
            <SettingDivider />
            
            <SettingRow label="Music Source Separation (MSS)" description="Extract vocals from mixed audio before transcription." layout="grid">
              <SettingSelect settingKey="mssEngine" value={store.mssEngine} options={MSS_ENGINE_OPTIONS} setter={store.setMssEngine} />
            </SettingRow>
            
            {store.mssEngine !== 'off' && (
              <div className="mt-4">
                <SettingRow label="MSS Model" layout="grid">
                  <SettingSelect settingKey="mssModel" value={store.mssModel} options={MSS_MODEL_OPTIONS} setter={store.setMssModel} />
                </SettingRow>
              </div>
            )}
            
            <SettingDivider />

            <SettingRow label="Use Batch Processing" description="Faster transcription via chunking.">
              <SettingToggle 
                settingKey="useBatch" 
                checked={store.useBatch} 
                setter={store.setUseBatch} 
                sideEffect={async (newValue) => {
                  if (newValue && store.vadEngine === 'off') {
                    store.setVadEngine('native');
                    await emit("setting-changed", { key: "vadEngine", value: 'native' });
                  }
                }}
              />
            </SettingRow>

            {store.useBatch && (
              <>
                <SettingDivider />
                <SettingGroup title="Batch Settings">
                  <SettingSlider settingKey="batchSize" label="Batch Size" value={store.batchSize} min={1} max={64} unit="" setter={store.setBatchSize} />
                </SettingGroup>
              </>
            )}
          </SettingSection>

          <SettingSection title="Display">
            <SettingRow label="Subtitle Overlay" description="Show generated subtitles directly on the video player">
              <SettingToggle settingKey="showSubtitles" checked={store.showSubtitles} setter={store.setShowSubtitles} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Japanese Dictionary Hover" description="Hover over Japanese subtitles to see readings and definitions">
              <SettingToggle settingKey="enableDictionary" checked={store.enableDictionary} setter={store.setEnableDictionary} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Japanese Furigana" description="Show Hiragana readings above Kanji in Japanese subtitles">
              <SettingToggle settingKey="enableFurigana" checked={store.enableFurigana} setter={store.setEnableFurigana} />
            </SettingRow>
          </SettingSection>

          <SettingSection title="Dual Subtitle Translation">
            <SettingRow label="Enable Translation" description="Automatically translate generated subtitles using local LLM">
              <SettingToggle settingKey="enableTranslation" checked={store.enableTranslation} setter={store.setEnableTranslation} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Target Language" layout="grid">
              <SettingSelect settingKey="targetLanguage" value={store.targetLanguage} options={TRANSLATION_LANGUAGES} setter={store.setTargetLanguage} />
            </SettingRow>
          </SettingSection>

          <SettingSection title="Subtitle Appearance & Layout">
            <SettingGroup title="Positioning">
              <SettingSlider settingKey="subtitlePositionX" label="Horizontal Position (X)" value={store.subtitlePositionX} min={0} max={100} unit="%" setter={store.setSubtitlePositionX} />
              <SettingSlider settingKey="subtitlePositionY" label="Vertical Position (Y)" value={store.subtitlePositionY} min={0} max={100} unit="%" setter={store.setSubtitlePositionY} />
            </SettingGroup>
            
            <SettingGroup title="Typography & Spacing">
              <SettingSlider settingKey="sttFontSize" label="Main Subtitle Size" value={store.sttFontSize} min={12} max={48} unit="px" setter={store.setSttFontSize} />
              <SettingSlider settingKey="translationFontSize" label="Translation Size" value={store.translationFontSize} min={12} max={48} unit="px" setter={store.setTranslationFontSize} />
              <SettingSlider settingKey="subtitleSpacing" label="Dual Subtitle Spacing" value={store.subtitleSpacing} min={0} max={40} unit="px" setter={store.setSubtitleSpacing} />
            </SettingGroup>
          </SettingSection>

        </div>
      </div>
    </div>
  );
};

