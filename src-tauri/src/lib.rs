use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter, State, Manager};
use std::sync::Mutex;
use std::path::PathBuf;

pub mod dictionary;
use dictionary::{DictionaryState, LookupResult};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn lookup_word(text: String, state: State<'_, Mutex<DictionaryState>>) -> Result<LookupResult, String> {
    let dict = state.lock().map_err(|e| e.to_string())?;
    dict.lookup(&text)
}

#[tauri::command]
async fn run_stt(app: AppHandle, video_path: String, model_size: String) -> Result<(), String> {
    std::thread::spawn(move || {
        let backend_dir = std::env::current_dir()
            .unwrap_or_default()
            .join("..")
            .join("src-backend");

        #[cfg(target_os = "windows")]
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut child_cmd = Command::new("uv");
        child_cmd
            .arg("run")
            .arg("main.py")
            .arg(&video_path)
            .arg("--model")
            .arg(&model_size)
            .current_dir(backend_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            child_cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = match child_cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let _ = app.emit("stt-progress", format!(r#"{{"type":"error","message":"Failed to spawn STT process: {}"}}"#, e));
                return;
            }
        };

        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line_str) = line {
                    let _ = app.emit("stt-progress", line_str);
                }
            }
        }
        
        let _ = child.wait();
    });
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
            let db_path = resource_dir.join("jmdict.db");
            
            // Fallback for dev environment if resource_dir doesn't have it
            let actual_db_path = if db_path.exists() {
                db_path
            } else {
                PathBuf::from("jmdict.db")
            };

            match DictionaryState::new(actual_db_path) {
                Ok(state) => {
                    app.manage(Mutex::new(state));
                }
                Err(e) => {
                    eprintln!("Failed to initialize dictionary: {}", e);
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, run_stt, lookup_word])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
