use std::path::PathBuf;

pub struct LogService;

impl LogService {
    pub fn save_agent_log(filename: String, content: String) -> Result<(), String> {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        
        let runtime_dir = if current_dir.ends_with("src-tauri") {
            current_dir.parent().unwrap_or(&current_dir).join(".runtime")
        } else {
            current_dir.join(".runtime")
        };

        if !runtime_dir.exists() {
            std::fs::create_dir_all(&runtime_dir).map_err(|e| e.to_string())?;
        }

        let file_path = runtime_dir.join(&filename);
        std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
        
        println!("Saved agent log to {:?}", file_path);
        Ok(())
    }
}
