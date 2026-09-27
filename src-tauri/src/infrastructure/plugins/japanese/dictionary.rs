use crate::domain::language::DictionaryEntry;
use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct JMDictService {
    db_path: PathBuf,
    conn: Mutex<Option<Connection>>,
}

impl JMDictService {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            db_path,
            conn: Mutex::new(None),
        }
    }

    pub fn query_word(&self, target_word: &str) -> Result<Vec<DictionaryEntry>, String> {
        let mut conn_guard = self.conn.lock().map_err(|e| format!("Mutex lock error: {}", e))?;
        if conn_guard.is_none() {
            let c = Connection::open_with_flags(&self.db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|e| format!("DB open error: {}", e))?;
            *conn_guard = Some(c);
        }
        let conn = conn_guard.as_ref().unwrap();

        let mut stmt = conn.prepare_cached(r#"
            SELECT DISTINCT e.id, e.kanji, e.kana, e.glossary 
            FROM entries e
            LEFT JOIN search_kanji sk ON e.id = sk.id
            LEFT JOIN search_kana ska ON e.id = ska.id
            WHERE sk.kanji = ?1 OR ska.kana = ?1
        "#).map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt.query_map([target_word], |row| {
            let id: String = row.get(0)?;
            let kanji_str: String = row.get(1)?;
            let kana_str: String = row.get(2)?;
            let gloss_str: String = row.get(3)?;

            let kanji: Vec<String> = serde_json::from_str(&kanji_str).unwrap_or_default();
            let kana: Vec<String> = serde_json::from_str(&kana_str).unwrap_or_default();
            let glossary: Vec<String> = serde_json::from_str(&gloss_str).unwrap_or_default();

            Ok(DictionaryEntry {
                id,
                headwords: kanji,
                pronunciations: kana,
                tags: vec![],
                glossary,
            })
        }).map_err(|e| format!("Query error: {}", e))?;

        let mut entries = Vec::new();
        for r in rows {
            if let Ok(entry) = r {
                entries.push(entry);
            }
        }
        
        Ok(entries)
    }
}
