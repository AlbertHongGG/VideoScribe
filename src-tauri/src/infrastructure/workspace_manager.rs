use std::path::{Path, PathBuf};
use chrono::Local;
use std::fs;

pub struct WorkspaceManager;

impl WorkspaceManager {
    /// Returns a centralized path for `.runtime/tmp` relative to the project root.
    pub fn get_runtime_tmp_dir() -> PathBuf {
        let current_exe = std::env::current_exe().unwrap_or_else(|_| std::env::current_dir().unwrap());
        let mut base_dir = current_exe;
        if base_dir.is_file() {
            base_dir.pop();
        }
        
        #[cfg(debug_assertions)]
        let base_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        
        let tmp_dir = base_dir.join(".runtime").join("tmp");
        if !tmp_dir.exists() {
            let _ = fs::create_dir_all(&tmp_dir);
        }
        tmp_dir
    }

    /// Gets or creates a workspace directory for the given video path.
    pub fn get_or_create_workspace(video_path: &str) -> String {
        let path = Path::new(video_path);
        
        let tmp_dir = Self::get_runtime_tmp_dir();
        
        if let Ok(abs_video) = std::fs::canonicalize(path) {
            if let Ok(abs_tmp) = std::fs::canonicalize(&tmp_dir) {
                if abs_video.starts_with(&abs_tmp) {
                    return abs_video.parent().unwrap_or(&abs_tmp).to_string_lossy().to_string();
                }
            }
        }
        
        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown");
        let safe_name: String = file_stem.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect();
        let folder_name = format!("{}_{}", timestamp, safe_name);
        
        let workspace_dir = tmp_dir.join(folder_name);
        if !workspace_dir.exists() {
            let _ = fs::create_dir_all(&workspace_dir);
        }
        
        workspace_dir.to_string_lossy().to_string()
    }
}
