use lindera::dictionary::load_dictionary;
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use lindera::tokenizer::Tokenizer;
use super::token::MorphemeToken;
use super::schema::{DictionarySchema, UnidicSchema};

pub struct JapaneseTokenizer {
    tokenizer: Tokenizer,
    schema: Box<dyn DictionarySchema>,
}

impl JapaneseTokenizer {
    pub fn new() -> Result<Self, String> {
        let dictionary = load_dictionary("embedded://unidic")
            .map_err(|e| format!("Failed to load embedded UniDic dictionary: {}", e))?;
            
        let segmenter = Segmenter::new(Mode::Normal, dictionary, None);
        let tokenizer = Tokenizer::new(segmenter);
        let schema = Box::new(UnidicSchema::new());

        Ok(Self { tokenizer, schema })
    }

    pub fn tokenize(&self, text: &str) -> Result<MorphemeToken, String> {
        let mut tokens = self.tokenizer.tokenize(text).map_err(|e| format!("Tokenize error: {}", e))?;
        if tokens.is_empty() {
            return Err("No tokens found".into());
        }
        
        let token = &mut tokens[0];
        let surface = token.surface.to_string();
        let details = token.details();
        let morpheme = self.schema.extract_morpheme(&surface, &details);

        Ok(morpheme)
    }

    pub fn tokenize_all(&self, text: &str) -> Result<Vec<MorphemeToken>, String> {
        let tokens = self.tokenizer.tokenize(text).map_err(|e| format!("Tokenize error: {}", e))?;
        
        let mut result = Vec::new();
        for mut token in tokens {
            let surface = token.surface.to_string();
            let details = token.details();
            result.push(self.schema.extract_morpheme(&surface, &details));
        }

        self.schema.apply_phonological_rules(&mut result);

        Ok(result)
    }
}

pub fn katakana_to_hiragana(kana: &str) -> String {
    kana.chars()
        .map(|c| {
            let code = c as u32;
            if (0x30A1..=0x30F6).contains(&code) {
                std::char::from_u32(code - 0x30A1 + 0x3041).unwrap_or(c)
            } else {
                c
            }
        })
        .collect()
}
