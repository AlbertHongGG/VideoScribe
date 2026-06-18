use lindera::dictionary::load_dictionary;
use lindera::mode::Mode;
use lindera::segmenter::Segmenter;
use lindera::tokenizer::Tokenizer;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug)]
pub struct DictionaryEntry {
    pub id: String,
    pub kanji: Vec<String>,
    pub kana: Vec<String>,
    pub glossary: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct LookupResult {
    pub original_text: String,
    pub token: String,
    pub base_form: String,
    pub reading: String,
    pub entries: Vec<DictionaryEntry>,
}

pub struct DictionaryState {
    pub tokenizer: Tokenizer,
    pub db_path: PathBuf,
}

impl DictionaryState {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        let dictionary = load_dictionary("embedded://ipadic")
            .map_err(|e| format!("Failed to load embedded dictionary: {}", e))?;
            
        let segmenter = Segmenter::new(Mode::Normal, dictionary, None);
        let tokenizer = Tokenizer::new(segmenter);

        Ok(Self {
            tokenizer,
            db_path,
        })
    }

    pub fn lookup(&self, text: &str) -> Result<LookupResult, String> {
        // Tokenize
        let mut tokens = self.tokenizer.tokenize(text).map_err(|e| format!("Tokenize error: {}", e))?;
        if tokens.is_empty() {
            return Err("No tokens found".into());
        }
        
        let token = &mut tokens[0];
        let token_text = token.surface.to_string();
        
        // Extract base form and reading using lindera API
        let details = token.details();
        
        let base_form = details.get(6).map(|s| s.to_string()).unwrap_or_else(|| token_text.clone());
        let reading = details.get(7).map(|s| s.to_string()).unwrap_or_default();

        let target_word = if base_form == "*" {
            token_text.clone()
        } else {
            base_form.clone()
        };

        let conn = Connection::open_with_flags(&self.db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| format!("DB open error: {}", e))?;

        // Query JMDict by exact kanji or kana
        let mut stmt = conn.prepare(r#"
            SELECT DISTINCT e.id, e.kanji, e.kana, e.glossary 
            FROM entries e
            LEFT JOIN search_kanji sk ON e.id = sk.id
            LEFT JOIN search_kana ska ON e.id = ska.id
            WHERE sk.kanji = ?1 OR ska.kana = ?1
        "#).map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt.query_map([&target_word], |row| {
            let id: String = row.get(0)?;
            let kanji_str: String = row.get(1)?;
            let kana_str: String = row.get(2)?;
            let gloss_str: String = row.get(3)?;

            let kanji: Vec<String> = serde_json::from_str(&kanji_str).unwrap_or_default();
            let kana: Vec<String> = serde_json::from_str(&kana_str).unwrap_or_default();
            let glossary: Vec<String> = serde_json::from_str(&gloss_str).unwrap_or_default();

            Ok(DictionaryEntry {
                id,
                kanji,
                kana,
                glossary,
            })
        }).map_err(|e| format!("Query error: {}", e))?;

        let mut entries = Vec::new();
        for r in rows {
            if let Ok(entry) = r {
                entries.push(entry);
            }
        }

        Ok(LookupResult {
            original_text: text.to_string(),
            token: token_text,
            base_form,
            reading,
            entries,
        })
    }
}
