pub mod tokenizer;
pub mod dictionary;

use crate::domain::language::{Language, LanguagePlugin, LookupResult, FuriganaToken};
use tokenizer::JapaneseTokenizer;
use dictionary::JMDictService;
use std::path::PathBuf;

pub struct JapanesePlugin {
    tokenizer: JapaneseTokenizer,
    dict_service: JMDictService,
}

impl JapanesePlugin {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let tokenizer = JapaneseTokenizer::new()?;
        let dict_service = JMDictService::new(db_path);

        Ok(Self { tokenizer, dict_service })
    }
}

impl LanguagePlugin for JapanesePlugin {
    fn get_language(&self) -> Language {
        Language::Japanese
    }

    fn lookup_word(&self, text: &str) -> Result<LookupResult, String> {
        let token_info = self.tokenizer.tokenize(text)?;
        
        let target_word = if token_info.base_form == "*" {
            token_info.token_text.clone()
        } else {
            token_info.base_form.clone()
        };

        let entries = self.dict_service.query_word(&target_word)?;

        Ok(LookupResult {
            original_text: text.to_string(),
            token: token_info.token_text,
            base_form: token_info.base_form,
            reading: token_info.reading,
            entries,
        })
    }

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
