import React from "react";
import { Download, Upload, Languages, Wand2, Sparkles, CheckCheck } from "lucide-react";
import { Tooltip } from "../ui/Tooltip";
import { SubtitleIOService } from "../../services/subtitleIOService";
import { useSTTJobStore, selectIsProcessing, selectCanTranslate } from "../../store/sttJobStore";

export const STTPanelHeader: React.FC = () => {
  const isProcessing = useSTTJobStore(selectIsProcessing);
  const canTranslate = useSTTJobStore(selectCanTranslate);

  return (
    <div className="px-6 py-5 border-b border-white/10 bg-black/20 flex items-center justify-between">
      <h2 className="font-bold text-white tracking-[0.2em] text-xs flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.8)]"></span>
        {isProcessing ? "PROCESSING PIPELINE" : "TRANSCRIPTION"}
      </h2>
      
      {!isProcessing && (
        <div className="flex items-center gap-3">
          {canTranslate && (
            <>
              <Tooltip content="AI Speech Proofreading" position="bottom">
                <button 
                  onClick={() => {
                    import("../../services/proofreadService").then(({ ProofreadService }) => {
                      ProofreadService.startProofread();
                    });
                  }}
                  className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
                >
                  <CheckCheck size={16} />
                </button>
              </Tooltip>
              <Tooltip content="AI Furigana Correction" position="bottom">
                <button 
                  onClick={() => {
                    import("../../services/rubyAnnotationService").then(({ RubyAnnotationService }) => {
                      RubyAnnotationService.startRubyAnnotation();
                    });
                  }}
                  className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
                >
                  <Sparkles size={16} />
                </button>
              </Tooltip>
              <Tooltip content="AI Semantic Segmentation" position="bottom">
                <button 
                  onClick={() => {
                    import("../../services/segmentationService").then(({ SegmentationService }) => {
                      SegmentationService.startSegmentation();
                    });
                  }}
                  className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
                >
                  <Wand2 size={16} />
                </button>
              </Tooltip>
              <Tooltip content="Translate Subtitles" position="bottom">
              <button 
                onClick={() => {
                  import("../../services/translationService").then(({ TranslationService }) => {
                    TranslationService.startTranslation();
                  });
                }}
                className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
              >
                <Languages size={16} />
              </button>
            </Tooltip>
            </>
          )}
          <Tooltip content="Import Subtitles" position="bottom">
            <button 
              onClick={() => SubtitleIOService.importSubtitles()}
              className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
            >
              <Upload size={16} />
            </button>
          </Tooltip>
          <Tooltip content="Export Subtitles" position="bottom">
            <button 
              onClick={() => SubtitleIOService.exportSubtitles()}
              className="text-gray-400 hover:text-[#facc15] transition-colors p-1"
            >
              <Download size={16} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
