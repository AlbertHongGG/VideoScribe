pub mod tokenizer;
pub mod dictionary;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use crate::domain::language::{LookupResult, FuriganaToken, DictionaryLookup, FuriganaProvider};
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

        // Register furigana provider capability for Japanese
        manager.register_service::<dyn FuriganaProvider>("japanese", plugin.clone());

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
                    token_info.token_text.clone()
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
                            token: token_info.token_text,
                            base_form: token_info.base_form,
                            reading: token_info.reading,
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

impl FuriganaProvider for JapanesePlugin {
    fn get_furigana(&self, text: &str) -> Result<Vec<FuriganaToken>, String> {
        let token_infos = self.tokenizer.tokenize_all(text)?;
        
        let mut furigana_tokens = Vec::new();
        for info in token_infos {
            let surface = info.token_text;
            
            // Check if surface contains Kanji (Unicode range 4E00-9FAF)
            let has_kanji = surface.chars().any(|c| {
                let code = c as u32;
                code >= 0x4E00 && code <= 0x9FAF
            });
            
            let reading = if has_kanji {
                info.reading.map(|r| tokenizer::katakana_to_hiragana(&r))
            } else {
                None
            };
            
            furigana_tokens.push(FuriganaToken {
                surface,
                reading,
            });
        }
        
        Ok(furigana_tokens)
    }
}
