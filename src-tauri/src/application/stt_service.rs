use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use serde_json::Value;

pub struct SttService;

impl SttService {
    pub fn run_stt(app: AppHandle, video_path: String, model_size: String) -> Result<(), String> {
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
                        if let Ok(json) = serde_json::from_str::<Value>(&line_str) {
                            if let Some(typ) = json.get("type").and_then(|t| t.as_str()) {
                                let state = app.state::<crate::infrastructure::state::AppState>();
                                if let Ok(mut project) = state.project.lock() {
                                    match typ {
                                        "progress" => {
                                            if let Some(status) = json.get("status").and_then(|s| s.as_str()) {
                                                let stt_status = match status {
                                                    "loading_model" => crate::domain::project::STTStatus::LoadingModel,
                                                    "transcribing" => crate::domain::project::STTStatus::Transcribing,
                                                    "completed" => crate::domain::project::STTStatus::Completed,
                                                    "error" => crate::domain::project::STTStatus::Error,
                                                    _ => crate::domain::project::STTStatus::Idle,
                                                };
                                                project.set_stt_status(stt_status);
                                            }
                                            if let Some(prog) = json.get("progress").and_then(|p| p.as_f64()) {
                                                project.update_stt_progress(prog);
                                            }
                                        }
                                        "result" => {
                                            if let (Some(start), Some(end), Some(text)) = (
                                                json.get("start").and_then(|v| v.as_f64()),
                                                json.get("end").and_then(|v| v.as_f64()),
                                                json.get("text").and_then(|v| v.as_str()),
                                            ) {
                                                project.add_stt_result(crate::domain::project::STTResult {
                                                    start,
                                                    end,
                                                    text: text.to_string(),
                                                    translation: None,
                                                });
                                            }
                                        }
                                        "error" => {
                                            project.set_stt_error();
                                        }
                                        _ => {}
                                    }
                                }
                                let _ = app.emit("app-state-changed", ());
                            }
                        }
                        // Also emit the raw string for backward compatibility or simple UI updates
                        let _ = app.emit("stt-progress", line_str);
                    }
                }
            }
            
            let _ = child.wait();
        });
        
        Ok(())
    }
}
