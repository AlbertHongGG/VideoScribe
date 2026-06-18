import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DictionaryEntry {
  id: string;
  kanji: string[];
  kana: string[];
  glossary: string[];
}

interface LookupResult {
  original_text: string;
  token: string;
  base_form: string;
  reading: string;
  entries: DictionaryEntry[];
}

interface Props {
  text: string;
  x: number;
  y: number;
  onClose?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

// Helper to convert Katakana to Hiragana
const kata2hira = (str: string) => {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
};

export const DictionaryTooltip: React.FC<Props> = ({ text, x, y, onClose, onMouseEnter, onMouseLeave }) => {
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const lookup = async () => {
      setLoading(true);
      try {
        const res = await invoke<LookupResult>("lookup_word", { text });
        if (active) {
          setResult(res);
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
  }, [text]);

  if (!loading && !result?.entries.length) {
    return null;
  }

  return (
    <div
      className="fixed z-[99999]"
      style={{
        left: Math.min(x, window.innerWidth - 340), // Keep it within screen bounds horizontally
        bottom: window.innerHeight - y, // Start exactly at cursor
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave || onClose}
    >
      <div className="pb-8"> {/* 32px gap for mouse to travel */}
        <div className="bg-slate-900/95 backdrop-blur-xl border border-yellow-500/20 rounded-2xl shadow-2xl p-4 w-[320px] pointer-events-auto overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="border-b border-white/10 pb-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tracking-wide">
                  {result?.base_form}
                </span>
                {result?.reading && result.reading !== result.base_form && (
                  <span className="text-sm font-medium text-yellow-300">
                    {kata2hira(result.reading)}
                  </span>
                )}
              </div>
            </div>

            <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {result?.entries.slice(0, 3).map((entry, idx) => (
                <div key={entry.id} className="mb-3 last:mb-0">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {entry.kanji.slice(0, 2).map((k) => (
                      <span key={k} className="text-xs bg-white/10 text-white/90 px-1.5 py-0.5 rounded">
                        {k}
                      </span>
                    ))}
                    {entry.kana.slice(0, 2).map((k) => (
                      <span key={k} className="text-xs bg-yellow-500/20 text-yellow-200 px-1.5 py-0.5 rounded">
                        {k}
                      </span>
                    ))}
                  </div>
                  <ul className="list-disc pl-4 space-y-1">
                    {entry.glossary.slice(0, 3).map((g, i) => (
                      <li key={i} className="text-sm text-gray-300 leading-snug">
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
