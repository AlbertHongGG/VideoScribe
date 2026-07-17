use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter, State, Manager};
use std::sync::Mutex;
use std::path::PathBuf;

pub mod dictionary;
use dictionary::{DictionaryState, LookupResult};

pub mod domain;
pub mod infrastructure;

pub fn create_builder() -> tauri_specta::Builder<tauri::Wry> {
    tauri_specta::Builder::<tauri::Wry>::new()
        .commands(tauri_specta::collect_commands![
            greet,
            lookup_word,
            save_agent_log,
            run_stt
        ])
}

#[tauri::command]
#[specta::specta]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
#[specta::specta]
fn lookup_word(text: String, state: State<'_, Mutex<DictionaryState>>) -> Result<LookupResult, String> {
    let dict = state.lock().map_err(|e| e.to_string())?;
    dict.lookup(&text)
}

#[tauri::command]
#[specta::specta]
fn save_agent_log(filename: String, content: String) -> Result<(), String> {
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    
    // In dev mode, current_dir is usually the project root (where package.json is)
    // or src-tauri. We want to put it in `.runtime` at the project root.
    // Let's safely try to use the current working directory's `.runtime` folder.
    let runtime_dir = if current_dir.ends_with("src-tauri") {
        current_dir.parent().unwrap_or(&current_dir).join(".runtime")
    } else {
        current_dir.join(".runtime")
    };

    if !runtime_dir.exists() {
        std::fs::create_dir_all(&runtime_dir).map_err(|e| e.to_string())?;
    }

    let file_path = runtime_dir.join(filename);
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    
    println!("Saved agent log to {:?}", file_path);
    Ok(())
}

#[tauri::command]
#[specta::specta]
async fn run_stt(app: AppHandle, video_path: String, model_size: String) -> Result<(), String> {
    std::thread::spawn(move || {
        let exe_dir = std::env::current_exe()
            .unwrap_or_else(|_| PathBuf::from("."))
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf();

        let backend_exe = exe_dir.join("backend").join("VideoScribe-backend.exe");
        
        let mut child_cmd;
        
        if backend_exe.exists() {
            // Portable mode
            child_cmd = Command::new(&backend_exe);
            child_cmd
                .arg(&video_path)
                .arg("--model")
                .arg(&model_size);
                
            // Add ffmpeg to PATH
            let ffmpeg_dir = exe_dir.join("ffmpeg").join("bin");
            if let Some(path_var) = std::env::var_os("PATH") {
                let mut paths = std::env::split_paths(&path_var).collect::<Vec<_>>();
                paths.insert(0, ffmpeg_dir);
                if let Ok(new_path) = std::env::join_paths(paths) {
                    child_cmd.env("PATH", new_path);
                }
            }
        } else {
            // Dev mode
            let backend_dir = std::env::current_dir()
                .unwrap_or_default()
                .join("..")
                .join("src-backend");

            child_cmd = Command::new("uv");
            child_cmd
                .arg("run")
                .arg("main.py")
                .arg(&video_path)
                .arg("--model")
                .arg(&model_size)
                .current_dir(backend_dir);
        }

        child_cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
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
    let builder = create_builder();

    tauri::Builder::default()
        .setup(|app| {
            let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
            let db_path = resource_dir.join("jmdict.db");
            
            let exe_dir = std::env::current_exe()
                .unwrap_or_else(|_| PathBuf::from("."))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .to_path_buf();
            let portable_db_path = exe_dir.join("jmdict.db");

            // Priority: Portable db -> Tauri resource db -> local fallback
            let actual_db_path = if portable_db_path.exists() {
                portable_db_path
            } else if db_path.exists() {
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
        .plugin(tauri_plugin_http::init())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
