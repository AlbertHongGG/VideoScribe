use crate::domain::language::{Language, LookupResult, FuriganaToken};
use crate::infrastructure::plugins::PluginManager;
use std::sync::Arc;

pub struct LanguageService;

impl LanguageService {
    pub fn lookup_word(
        plugin_manager: Arc<PluginManager>,
        language: Language,
        text: &str
    ) -> Result<LookupResult, String> {
        if let Some(plugin) = plugin_manager.get_plugin(&language) {
            plugin.lookup_word(text)
        } else {
            Err("Dictionary lookup not supported for this language".into())
        }
    }

    pub fn get_furigana(
        text: &str,
        language: &Language,
        plugin_manager: &PluginManager,
    ) -> Result<Vec<FuriganaToken>, String> {
        if let Some(plugin) = plugin_manager.get_plugin(language) {
            return plugin.get_furigana(text);
        }
        
        Err("Furigana not supported for this language".into())
    }
}
