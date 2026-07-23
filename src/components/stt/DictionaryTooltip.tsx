import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LookupResult } from "../../types/bindings";

interface Props {
  text: string; // Now acts as fullText
  charIndex?: number;
  x: number;
  y: number;
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const DictionaryTooltip: React.FC<Props> = ({ text, charIndex = 0, x, y, onClose, onMouseEnter, onMouseLeave }) => {
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const lookup = async () => {
      setLoading(true);
      try {
        const res = await invoke<LookupResult[]>("lookup_word", { text, index: charIndex });
        if (active) {
          setResults(res);
        }
      } catch (e) {
        console.error("Dictionary lookup failed:", e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(() => {
      lookup();
    }, 150);

    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [text, charIndex]);

  if (!loading && (!results || results.length === 0)) {
    return null;
  }

  return (
    <div
      className="fixed z-[99999] pointer-events-none"
      style={{
        left: Math.min(x, window.innerWidth - 340),
        bottom: window.innerHeight - y + 15,
      }}
    >
      <div 
        className="bg-black/40 backdrop-blur-md border border-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-2xl p-4 w-[320px] pointer-events-auto overflow-hidden"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave || onClose}
      >
        {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-[#facc15] border-t-transparent rounded-full animate-spin"></div>
            </div>
        ) : (
          <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {results?.map((res, idx) => (
              <div key={`${res.base_form}-${idx}`} className="flex flex-col gap-2">
                {/* Layer Divider if not first */}
                {idx > 0 && <div className="border-t border-white/5 my-1" />}
                
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white tracking-wide">
                    {res.base_form}
                  </span>
                  {res.reading && res.reading !== res.base_form && (
                    <span className="text-sm font-medium text-[#facc15]/80">
                      {res.reading}
                    </span>
                  )}
                  {/* Show the prefix being analyzed to give context */}
                  <span className="text-[10px] text-white/30 ml-auto border border-white/10 px-1 rounded">
                    {res.original_text}
                  </span>
                </div>
                
                <div className="flex flex-col gap-2">
                  {res.entries.slice(0, 2).map((entry) => (
                    <div key={entry.id} className="bg-white/5 rounded-lg p-2">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {entry.headwords.slice(0, 2).map((k) => (
                          <span key={k} className="text-xs bg-white/10 text-white/90 px-1.5 py-0.5 rounded font-bold">
                            {k}
                          </span>
                        ))}
                        {entry.pronunciations.slice(0, 2).map((k) => (
                          <span key={k} className="text-xs bg-[#facc15]/20 text-[#facc15] px-1.5 py-0.5 rounded font-mono">
                            {k}
                          </span>
                        ))}
                        {entry.tags && entry.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                            {t}
                          </span>
                        ))}
                      </div>
                      <ul className="list-disc pl-4 mt-1 space-y-1">
                        {entry.glossary.slice(0, 3).map((g, i) => (
                          <li key={i} className="text-sm text-white/80 leading-snug">
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

