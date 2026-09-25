use serde::{Deserialize, Serialize};
use specta::Type;
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash, Type)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Japanese,
    Chinese,
    English,
    // Future languages can be added here
}

impl std::str::FromStr for Language {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "japanese" | "ja" => Ok(Language::Japanese),
            "chinese" | "zh" => Ok(Language::Chinese),
            "english" | "en" => Ok(Language::English),
            _ => Err(format!("Unsupported language: {}", s)),
        }
    }
}

impl std::fmt::Display for Language {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Language::Japanese => "japanese",
            Language::Chinese => "chinese",
            Language::English => "english",
        };
        write!(f, "{}", s)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct DictionaryEntry {
    pub id: String,
    pub headwords: Vec<String>,
    pub pronunciations: Vec<String>,
    pub tags: Vec<String>,
    pub glossary: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TS, Type)]
#[ts(export, export_to = "../../src/types/app_types.ts")]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum RubySegment {
    /// Non-ruby text segment (e.g. Kana, punctuation, whitespace).
    /// Functions as pure text without annotations.
    Text { text: String },

    /// Ruby annotated segment (e.g. Kanji with Furigana, Hanzi with Pinyin).
    /// Guaranteed to possess non-null base text and ruby annotation.
    Ruby { base: String, ruby: String },
}

impl RubySegment {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }

    pub fn ruby(base: impl Into<String>, ruby: impl Into<String>) -> Self {
        Self::Ruby {
            base: base.into(),
            ruby: ruby.into(),
        }
    }

    pub fn text_content(&self) -> &str {
        match self {
            Self::Text { text } => text,
            Self::Ruby { base, .. } => base,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct LookupResult {
    pub original_text: String,
    pub token: String,
    pub base_form: String,
    pub reading: Option<String>,
    pub entries: Vec<DictionaryEntry>,
}

pub trait DictionaryLookup: Send + Sync {
    fn lookup_word(&self, text: &str, index: usize) -> Result<Vec<LookupResult>, String>;
}

/// Provides phonetic guide / ruby annotation capabilities for a language.
pub trait RubyAnnotationProvider: Send + Sync {
    fn annotate(&self, text: &str) -> Result<Vec<RubySegment>, String>;
}
