pub mod tokenizer;
pub mod dictionary;
pub mod ruby_aligner;
pub mod token;
pub mod schema;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use crate::domain::language::{LookupResult, RubySegment, DictionaryLookup, RubyAnnotationProvider};
use crate::infrastructure::plugins::manager::PluginManager;
use tokenizer::JapaneseTokenizer;
use dictionary::JMDictService;

pub struct JapanesePlugin {
    tokenizer: JapaneseTokenizer,
    dict_service: JMDictService,
}

impl JapanesePlugin {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
        let db_path = resource_dir.join("jmdict.db");
        
        let exe_dir = std::env::current_exe()
            .unwrap_or_else(|_| PathBuf::from("."))
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf();
        let portable_db_path = exe_dir.join("jmdict.db");

        let actual_db_path = if portable_db_path.exists() {
            portable_db_path
        } else if db_path.exists() {
            db_path
        } else {
            PathBuf::from("jmdict.db")
        };

        let tokenizer = JapaneseTokenizer::new()?;
        let dict_service = JMDictService::new(actual_db_path);

        Ok(Self { tokenizer, dict_service })
    }

    /// Self-registration method to register provided capabilities into PluginManager.
    pub fn register(app: &AppHandle, manager: &mut PluginManager) -> Result<(), String> {
        let plugin = Arc::new(Self::new(app)?);

        // Register dictionary lookup capability for Japanese
        manager.register_service::<dyn DictionaryLookup>("japanese", plugin.clone());

        // Register ruby annotation provider capability for Japanese
        manager.register_service::<dyn RubyAnnotationProvider>("japanese", plugin.clone());

        Ok(())
    }
}

impl DictionaryLookup for JapanesePlugin {
    fn lookup_word(&self, text: &str, index: usize) -> Result<Vec<LookupResult>, String> {
        let chars: Vec<char> = text.chars().collect();
        if index >= chars.len() {
            return Err("Index out of bounds".to_string());
        }

        // Limit the prefix length to something reasonable (e.g. 15 chars)
        let target_len = std::cmp::min(15, chars.len() - index);
        
        let mut results = Vec::new();
        let mut seen_base_forms = std::collections::HashSet::new();

        // Check shortest prefix first so original_text is concise, then reverse later
        for len in 1..=target_len {
            let prefix: String = chars[index..index + len].iter().collect();
            
            // 1. Direct dictionary query (captures compound words & full surfaces like 'お世話' or Katakana compounds)
            if !seen_base_forms.contains(&prefix) {
                if let Ok(entries) = self.dict_service.query_word(&prefix) {
                    if !entries.is_empty() {
                        seen_base_forms.insert(prefix.clone());
                        let reading = entries.first().and_then(|e| e.pronunciations.first().cloned());
                        results.push(LookupResult {
                            original_text: prefix.clone(),
                            token: prefix.clone(),
                            base_form: prefix.clone(),
                            reading,
                            entries,
                        });
                    }
                }
            }

            // 2. Tokenize the prefix to handle inflections / base forms (e.g. 食べた -> 食べる)
            if let Ok(token_info) = self.tokenizer.tokenize(&prefix) {
                let target_word = if token_info.base_form == "*" {
                    token_info.surface.clone()
                } else {
                    token_info.base_form.clone()
                };

                // Deduplicate by base_form to avoid showing the same entry multiple times
                if seen_base_forms.contains(&target_word) {
                    continue;
                }
                seen_base_forms.insert(target_word.clone());

                // Query dictionary
                if let Ok(entries) = self.dict_service.query_word(&target_word) {
                    if !entries.is_empty() {
                        results.push(LookupResult {
                            original_text: prefix,
                            token: token_info.surface,
                            base_form: token_info.base_form,
                            reading: token_info.reading_hiragana,
                            entries,
                        });
                    }
                }
            }
        }

        // Reverse so longest matches appear first
        results.reverse();

        Ok(results)
    }
}

impl RubyAnnotationProvider for JapanesePlugin {
    fn annotate(&self, text: &str) -> Result<Vec<RubySegment>, String> {
        let tokens = self.tokenizer.tokenize_all(text)?;
        
        let mut raw_segments = Vec::new();
        let mut cursor = 0;

        for token in tokens {
            let surface = token.surface;
            
            // Re-align with original text to preserve any skipped characters (e.g. whitespace, symbols)
            if let Some(rel_idx) = text[cursor..].find(&surface) {
                if rel_idx > 0 {
                    let gap = &text[cursor..cursor + rel_idx];
                    raw_segments.push(RubySegment::text(gap));
                }
                cursor += rel_idx + surface.len();
            }

            if ruby_aligner::RubyAligner::has_kanji(&surface) {
                if let Some(r) = token.reading_hiragana {
                    let aligned = ruby_aligner::RubyAligner::align(&surface, &r);
                    raw_segments.extend(aligned);
                } else {
                    raw_segments.push(RubySegment::text(surface));
                }
            } else {
                raw_segments.push(RubySegment::text(surface));
            }
        }

        // Preserve any trailing characters (e.g. trailing whitespace or punctuation)
        if cursor < text.len() {
            raw_segments.push(RubySegment::text(&text[cursor..]));
        }

        // Preserve individual morphological token boundaries for precise word-level interaction and dictionary lookup
        let segments: Vec<RubySegment> = raw_segments
            .into_iter()
            .filter(|s| match s {
                RubySegment::Text { text } => !text.is_empty(),
                RubySegment::Ruby { base, .. } => !base.is_empty(),
            })
            .collect();
        
        Ok(segments)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ruby_annotation_provider() {
        let tokenizer = JapaneseTokenizer::new().unwrap();
        let plugin = JapanesePlugin {
            tokenizer,
            dict_service: JMDictService::new(PathBuf::from("jmdict.db")),
        };

        let cases = vec![
            "フリーサイトで明日まで一泊ですね。",
            "もしよかったらおばあちゃん家一緒に泊まりに来ない？",
            "浜で一日本読んで",
            "ご飯を美味しく食べる。",
            "りんちゃんも 山梨からよう来たね",
            "あ… はじめまして お世話になります",
            "はあ… ないっこ 久しぶり",
            "おお! アヤちゃん もう来てたんだ!",
            "おお! この子は 時彩乃ちゃん",
            "  前後にスペース  ",
            "全角　スペースと　複数   スペース",
            "りんちゃんみたいに頑張って原付きでさ",
            "このままただ今",
        ];

        for text in cases {
            let segments = plugin.annotate(text).unwrap();
            let reconstructed: String = segments.iter().map(|s| s.text_content()).collect();
            println!("\n=== INPUT: {} ===", text);
            println!("RECONSTRUCTED: {}", reconstructed);
            for s in &segments {
                match s {
                    RubySegment::Ruby { base, ruby } => {
                        println!("  [RUBY] {} -> {}", base, ruby);
                    }
                    RubySegment::Text { text } => {
                        println!("  [TEXT] {}", text);
                    }
                }
            }
            assert_eq!(reconstructed, text);
        }
    }

    #[test]
    fn test_lookup_word() {
        let tokenizer = JapaneseTokenizer::new().unwrap();
        let plugin = JapanesePlugin {
            tokenizer,
            dict_service: JMDictService::new(PathBuf::from("jmdict.db")),
        };

        let text = "女子ソロキャンパーのリンちゃんみたいなローチェア";
        // 1. Hover at char index 0: '女'
        let res_0 = plugin.lookup_word(text, 0).unwrap();
        assert!(!res_0.is_empty(), "Should find 女子 at index 0");
        assert!(res_0.iter().any(|r| r.token == "女子"));

        // 2. Hover at index 2: 'ソ' (ソロ)
        let res_solo = plugin.lookup_word(text, 2).unwrap();
        assert!(!res_solo.is_empty(), "Should find ソロ at index 2");
        assert!(res_solo.iter().any(|r| r.token == "ソロ"));

        // 3. Hover at index 4: 'キ' (キャンパー)
        let res_camper = plugin.lookup_word(text, 4).unwrap();
        assert!(!res_camper.is_empty(), "Should find キャンパー at index 4");
        assert!(res_camper.iter().any(|r| r.token == "キャンパー"));

        // 4. Hover at index 19: 'ロ' (ロー)
        let res_ro = plugin.lookup_word(text, 19).unwrap();
        assert!(!res_ro.is_empty(), "Should find ロー at index 19");
        assert!(res_ro.iter().any(|r| r.token == "ロー"));

        // 5. Hover at index 21: 'チ' (チェア)
        let res_chair = plugin.lookup_word(text, 21).unwrap();
        assert!(!res_chair.is_empty(), "Should find チェア at index 21");
        assert!(res_chair.iter().any(|r| r.token == "チェア"));

        // 6. Compound expression lookup: お世話
        let text_osewa = "あ… お世話になります";
        let osewa_idx = text_osewa.chars().position(|c| c == 'お').unwrap();
        let res_osewa = plugin.lookup_word(text_osewa, osewa_idx).unwrap();
        assert!(!res_osewa.is_empty(), "Should find お世話");
        assert!(res_osewa.iter().any(|r| r.token == "お世話"));
    }
}
