import { useSTTSettingsStore } from "../../store/sttSettingsStore";

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
  { value: "off", label: "Off" },
  { value: "native", label: "Native (Whisper Built-in)" },
  { value: "silero_v6", label: "Silero VAD v6" },
  { value: "firered_vad", label: "FireRedVAD" },
];

const MSS_ENGINE_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "audio_separator", label: "Audio-Separator Plugin" }
];

const MSS_MODEL_OPTIONS = [
  { value: "model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt", label: "MelBandRoformer (High Quality)" },
  { value: "model_bs_roformer_ep_317_sdr_12.9755.ckpt", label: "BSRoformer" },
  { value: "UVR-MDX-NET-Inst_HQ_3.onnx", label: "MDX-Net (Fast)" }
];

const FA_ENGINE_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "ctc_forced_aligner", label: "CTC Forced Aligner" }
];

const FA_MODEL_OPTIONS = [
  { value: "mms-300m", label: "Meta MMS-300M (Balanced)" },
  { value: "mms-1b-all", label: "Meta MMS-1B (High Quality)" },
  { value: "wav2vec2-large-xlsr-53-chinese", label: "Wav2Vec2 Chinese" },
  { value: "wav2vec2-large-960h-lv60k", label: "Wav2Vec2 English" }
];

export const SettingsPanel: React.FC = () => {
  const store = useSTTSettingsStore();


  return (
    <div className="w-full h-full p-8 text-white overflow-y-auto custom-scrollbar bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto pt-4">
        <div className="space-y-8">

          <SettingSection title="Speech-to-Text (STT) Engine">
            <SettingRow label="Model Size" layout="grid">
              <SettingSelect settingKey="model" value={store.model} options={MODEL_OPTIONS} setter={store.setModel} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Language Detection" layout="grid">
              <SettingSelect settingKey="language" value={store.language || "auto"} options={LANGUAGE_OPTIONS} setter={store.setLanguage} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Voice Activity Detection (VAD)" description="Filter out silence before or during recognition." layout="grid">
              <SettingSelect
                settingKey="vadEngine"
                value={store.vadEngine}
                options={VAD_ENGINE_OPTIONS}
                setter={store.setVadEngine}
              />
            </SettingRow>
            <SettingDivider />

            <SettingRow label="Batch Processing" description="Accelerate transcription via parallel chunking.">
              <SettingToggle
                settingKey="useBatch"
                checked={store.useBatch}
                setter={store.setUseBatch}
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

          <SettingSection title="Music Source Separation (MSS)">
            <SettingRow label="Audio Separation Engine" description="Separate vocals from background music/instruments before transcription." layout="grid">
              <SettingSelect settingKey="mssEngine" value={store.mssEngine} options={MSS_ENGINE_OPTIONS} setter={store.setMssEngine} />
            </SettingRow>

            {store.mssEngine !== 'off' && (
              <>
                <SettingDivider />
                <SettingRow label="Separation Model" description="Select neural network model for stem extraction." layout="grid">
                  <SettingSelect settingKey="mssModel" value={store.mssModel} options={MSS_MODEL_OPTIONS} setter={store.setMssModel} />
                </SettingRow>
                <SettingDivider />
                <SettingGroup title="Audio Stem Mixing & Volume Balance">
                  <SettingSlider settingKey="vocalVolume" label="Vocals Volume" value={store.vocalVolume} min={0} max={100} unit="%" setter={store.setVocalVolume} />
                  <SettingSlider settingKey="backgroundVolume" label="Background Music Volume" value={store.backgroundVolume} min={0} max={100} unit="%" setter={store.setBackgroundVolume} />
                </SettingGroup>
              </>
            )}
          </SettingSection>

          <SettingSection title="Forced Alignment">
            <SettingRow label="Alignment Engine" description="Precisely align transcription timestamps with audio." layout="grid">
              <SettingSelect settingKey="faEngine" value={store.faEngine} options={FA_ENGINE_OPTIONS} setter={store.setFaEngine} />
            </SettingRow>

            {store.faEngine !== 'off' && (
              <>
                <SettingDivider />
                <SettingRow label="Alignment Model" description="Select the acoustic model for alignment." layout="grid">
                  <SettingSelect settingKey="faModel" value={store.faModel} options={FA_MODEL_OPTIONS} setter={store.setFaModel} />
                </SettingRow>
              </>
            )}
          </SettingSection>

          <SettingSection title="Display">
            <SettingRow label="Subtitle Overlay" description="Show generated subtitles directly on the video player">
              <SettingToggle settingKey="showSubtitles" checked={store.showSubtitles} setter={store.setShowSubtitles} />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Karaoke Mode (KTV)" description="Highlight words dynamically as they are spoken">
              <SettingToggle settingKey="enableKaraokeMode" checked={store.enableKaraokeMode} setter={store.setEnableKaraokeMode} />
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
