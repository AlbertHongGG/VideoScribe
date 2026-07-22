use serde::{Deserialize, Serialize};
use specta::Type;

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

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct FuriganaToken {
    pub surface: String,
    pub reading: Option<String>,
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
    fn lookup_word(&self, text: &str) -> Result<LookupResult, String>;
}

pub trait FuriganaProvider: Send + Sync {
    fn get_furigana(&self, text: &str) -> Result<Vec<FuriganaToken>, String>;
}
