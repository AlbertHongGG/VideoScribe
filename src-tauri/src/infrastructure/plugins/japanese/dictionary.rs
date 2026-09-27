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

    fn get_or_init_connection(&self) -> Result<std::sync::MutexGuard<'_, Option<Connection>>, String> {
        let mut conn_guard = self.conn.lock().map_err(|e| format!("Mutex lock error: {}", e))?;
        if conn_guard.is_none() {
            let conn = Connection::open_with_flags(&self.db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|e| format!("DB open error at {:?}: {}", self.db_path, e))?;

            // Configure SQLite for blazing-fast, read-only in-memory queries
            let _ = conn.execute_batch(
                r#"
                PRAGMA mmap_size = 268435456;
                PRAGMA cache_size = -64000;
                PRAGMA temp_store = MEMORY;
                PRAGMA query_only = ON;
                "#
            );

            *conn_guard = Some(conn);
        }
        Ok(conn_guard)
    }

    pub fn query_word(&self, target_word: &str) -> Result<Vec<DictionaryEntry>, String> {
        let conn_guard = self.get_or_init_connection()?;
        let conn = conn_guard.as_ref().unwrap();

        // High-performance index-seek subquery pattern:
        // Uses idx_search_kanji and idx_search_kana B-tree indexes directly,
        // eliminating full table scans on entries.
        let mut stmt = conn.prepare_cached(r#"
            SELECT e.id, e.kanji, e.kana, e.glossary 
            FROM entries e
            WHERE e.id IN (
                SELECT id FROM search_kanji WHERE kanji = ?1
                UNION
                SELECT id FROM search_kana WHERE kana = ?1
            )
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
