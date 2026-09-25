use tauri::State;
use crate::domain::language::{LookupResult, RubySegment, DictionaryLookup, RubyAnnotationProvider};
use crate::infrastructure::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn lookup_word(text: String, index: u32, state: State<'_, AppState>) -> Result<Vec<LookupResult>, String> {
    let provider = state.plugin_manager
        .get_service::<dyn DictionaryLookup>("japanese")
        .ok_or_else(|| "Dictionary lookup provider for Japanese not found".to_string())?;

    provider.lookup_word(&text, index as usize)
}

#[tauri::command]
#[specta::specta]
pub fn get_ruby_annotations(text: String, state: State<'_, AppState>) -> Result<Vec<RubySegment>, String> {
    let provider = state.plugin_manager
        .get_service::<dyn RubyAnnotationProvider>("japanese")
        .ok_or_else(|| "Ruby annotation provider for Japanese not found".to_string())?;

    provider.annotate(&text)
}
