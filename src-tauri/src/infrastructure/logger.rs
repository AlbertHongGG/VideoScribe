use chrono::Local;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

pub struct AppLogger {}

#[derive(Serialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub component: String,
    pub metadata: Value,
    pub request: Value,
    pub response: Value,
}

impl AppLogger {
    pub fn init() {}

    pub fn log(component: &str, metadata: Value, request: Value, response: Value) {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let mut path = if current_dir.ends_with("src-tauri") {
            current_dir.parent().unwrap_or(&current_dir).join(".runtime").join("logs").join(component)
        } else {
            current_dir.join(".runtime").join("logs").join(component)
        };

        if let Err(e) = std::fs::create_dir_all(&path) {
            println!("Warning: Failed to create log directory for {}: {}", component, e);
            return;
        }

        let parsed_response: Value = if let Some(s) = response.as_str() {
            serde_json::from_str(s).unwrap_or(response.clone())
        } else {
            response.clone()
        };

        let nanos = Local::now().timestamp_subsec_nanos();
        let random_id = format!("{:06x}", nanos % 0xFFFFFF);
            
        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        path.push(format!("{}_{}_{}.json", timestamp, component, random_id));

        let entry = LogEntry {
            timestamp: Local::now().to_rfc3339(),
            component: component.to_string(),
            metadata,
            request,
            response: parsed_response,
        };

        if let Ok(mut file) = std::fs::File::create(&path) {
            let _ = serde_json::to_writer_pretty(&mut file, &entry);
        }
    }
}
