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
            
            // Tokenize the prefix. We only care about the FIRST token returned, 
            // as we are building prefixes starting from the hovered character.
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
        
        let mut segments = Vec::new();
        for token in tokens {
            let surface = token.surface;
            
            if ruby_aligner::RubyAligner::has_kanji(&surface) {
                if let Some(r) = token.reading_hiragana {
                    let aligned = ruby_aligner::RubyAligner::align(&surface, &r);
                    segments.extend(aligned);
                } else {
                    segments.push(RubySegment::text(surface));
                }
            } else {
                segments.push(RubySegment::text(surface));
            }
        }
        
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
}
