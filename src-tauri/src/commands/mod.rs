pub mod language;
pub mod pipeline;
pub mod translation;
pub mod project;
pub mod segmentation;

pub fn create_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            language::japanese::lookup_word,
            language::japanese::get_furigana,
            pipeline::trigger_pipeline,
            pipeline::cancel_pipeline,
            pipeline::import_pipeline_results,
            translation::start_translation,
            translation::run_agent_task,
            segmentation::start_segmentation,
            project::get_app_state,
        ])
}
