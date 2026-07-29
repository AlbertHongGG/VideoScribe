use tauri::State;
use crate::infrastructure::state::AppState;
use crate::domain::project::ProjectState;
use crate::infrastructure::workspace_manager::WorkspaceManager;
use serde_json::Value;
use std::fs::File;
use zip::{ZipWriter, ZipArchive};

#[tauri::command]
#[specta::specta]
pub fn get_app_state(state: State<'_, AppState>) -> Result<ProjectState, String> {
    let project = state.project.lock().map_err(|e| e.to_string())?;
    Ok(project.clone())
}

#[tauri::command]
#[specta::specta]
pub fn export_mss_stems(state: State<'_, AppState>, export_path: String) -> Result<(), String> {
    let project = state.project.lock().map_err(|e| e.to_string())?;
    
    let vocals_path = project.vocals_audio_path.clone();
    let background_path = project.background_audio_path.clone();
    
    if vocals_path.is_none() && background_path.is_none() {
        return Err("No stems available to export.".to_string());
    }

    let file = File::create(&export_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    if let Some(v_path) = vocals_path {
        if std::path::Path::new(&v_path).exists() {
            let file_name = std::path::Path::new(&v_path).file_name().unwrap().to_string_lossy().to_string();
            zip.start_file(file_name, options.clone()).map_err(|e| e.to_string())?;
            let mut f = File::open(&v_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
    }

    if let Some(b_path) = background_path {
        if std::path::Path::new(&b_path).exists() {
            let file_name = std::path::Path::new(&b_path).file_name().unwrap().to_string_lossy().to_string();
            zip.start_file(file_name, options.clone()).map_err(|e| e.to_string())?;
            let mut f = File::open(&b_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn import_mss_stems(app: tauri::AppHandle, state: State<'_, AppState>, import_path: String) -> Result<(), String> {
    let mut project = state.project.lock().map_err(|e| e.to_string())?;
    let video_path = project.video_path.clone().ok_or_else(|| "No active video to import stems into.".to_string())?;
    
    let workspace = WorkspaceManager::get_or_create_workspace(&video_path);
    project.workspace_dir = Some(workspace.clone());
    
    let mss_assets_dir = std::path::Path::new(&workspace).join("mss_assets");
    std::fs::create_dir_all(&mss_assets_dir).map_err(|e| e.to_string())?;

    let file = File::open(&import_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut new_vocals = None;
    let mut new_background = None;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let file_name = outpath.file_name().unwrap().to_string_lossy().to_string().to_lowercase();
        let target_path = mss_assets_dir.join(&file_name);

        if let Some(p) = target_path.parent() {
            if !p.exists() {
                std::fs::create_dir_all(&p).map_err(|e| e.to_string())?;
            }
        }

        let mut outfile = File::create(&target_path).map_err(|e| e.to_string())?;
        std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;

        let abs_path = target_path.to_string_lossy().to_string();
        if file_name.contains("vocal") || file_name.contains("vocals") {
            new_vocals = Some(abs_path.clone());
        } else if file_name.contains("instrumental") || file_name.contains("background") {
            new_background = Some(abs_path.clone());
        } else {
            // fallback
            if new_vocals.is_none() {
                new_vocals = Some(abs_path.clone());
            } else if new_background.is_none() {
                new_background = Some(abs_path.clone());
            }
        }
    }

    project.vocals_audio_path = new_vocals;
    project.background_audio_path = new_background;

    use tauri::Emitter;
    let _ = app.emit("app-state-changed", Value::Null);

    Ok(())
}
