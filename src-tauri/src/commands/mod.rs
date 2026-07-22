pub mod language;
pub mod stt;
pub mod translation;
pub mod project;

pub fn create_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            language::japanese::lookup_word,
            language::japanese::get_furigana,
            stt::start_stt_job,
            stt::cancel_stt_job,
            stt::import_stt_results,
            translation::start_translation,
            translation::run_agent_task,
            project::get_app_state,
        ])
}
