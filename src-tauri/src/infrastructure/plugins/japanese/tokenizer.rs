use lindera::dictionary::load_dictionary;
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use lindera::tokenizer::Tokenizer;

pub struct JapaneseTokenizer {
    tokenizer: Tokenizer,
}

pub struct TokenInfo {
    pub token_text: String,
    pub base_form: String,
    pub reading: Option<String>,
}

impl JapaneseTokenizer {
    pub fn new() -> Result<Self, String> {
        let dictionary = load_dictionary("embedded://ipadic")
            .map_err(|e| format!("Failed to load embedded dictionary: {}", e))?;
            
        let segmenter = Segmenter::new(Mode::Normal, dictionary, None);
        let tokenizer = Tokenizer::new(segmenter);

        Ok(Self { tokenizer })
    }

    pub fn tokenize(&self, text: &str) -> Result<TokenInfo, String> {
        let mut tokens = self.tokenizer.tokenize(text).map_err(|e| format!("Tokenize error: {}", e))?;
        if tokens.is_empty() {
            return Err("No tokens found".into());
        }
        
        let token = &mut tokens[0];
        let token_text = token.surface.to_string();
        
        let details = token.details();
        let base_form = details.get(6).map(|s| s.to_string()).unwrap_or_else(|| token_text.clone());
        let reading = details.get(7).map(|s| s.to_string());

        Ok(TokenInfo {
            token_text,
            base_form,
            reading,
        })
    }

    pub fn tokenize_all(&self, text: &str) -> Result<Vec<TokenInfo>, String> {
        let tokens = self.tokenizer.tokenize(text).map_err(|e| format!("Tokenize error: {}", e))?;
        
        let mut result = Vec::new();
        for mut token in tokens {
            let token_text = token.surface.to_string();
            let details = token.details();
            let base_form = details.get(6).map(|s| s.to_string()).unwrap_or_else(|| token_text.clone());
            let reading = details.get(7).map(|s| s.to_string());
            
            result.push(TokenInfo {
                token_text,
                base_form,
                reading,
            });
        }

        Ok(result)
    }
}

pub fn katakana_to_hiragana(kana: &str) -> String {
    kana.chars()
        .map(|c| {
            let code = c as u32;
            if code >= 0x30A1 && code <= 0x30F6 {
                std::char::from_u32(code - 0x30A1 + 0x3041).unwrap_or(c)
            } else {
                c
            }
        })
        .collect()
}
