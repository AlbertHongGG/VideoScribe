use crate::domain::stt::STTProvider;
use serde_json::Value;
use std::process::Command;
use std::path::PathBuf;
use reqwest::Client;
use reqwest_eventsource::{Event, EventSource};
use futures_util::StreamExt;

use tauri::Manager;

pub struct LocalSTTProvider {
    app: tauri::AppHandle,
}

impl LocalSTTProvider {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
}

impl STTProvider for LocalSTTProvider {
    fn start_transcription(
        &self,
        video_path: &str,
        model_size: &str,
        on_event: Box<dyn Fn(Value) + Send + Sync>,
    ) -> Result<(), String> {
        let video_path = video_path.to_string();
        let model_size = model_size.to_string();
        
        let port = match std::net::TcpListener::bind("127.0.0.1:0") {
            Ok(listener) => {
                let p = listener.local_addr().unwrap().port();
                drop(listener);
                p
            },
            Err(e) => {
                let err_msg = serde_json::json!({"type": "error", "message": format!("OS failed to allocate a dynamic port: {}", e)});
                on_event(err_msg);
                return Ok(());
            }
        };
        let app = self.app.clone();

        std::thread::spawn(move || {
            // Portable Resource resolution via Tauri API
            let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
            let backend_exe = resource_dir.join("backend").join("VideoScribe-backend.exe");
            
            let mut child_cmd;
            
            if backend_exe.exists() {
                child_cmd = Command::new(&backend_exe);
                child_cmd
                    .arg("--port")
                    .arg(port.to_string());
                    let ffmpeg_dir = resource_dir.join("ffmpeg").join("bin");
                if let Some(path_var) = std::env::var_os("PATH") {
                    let mut paths = std::env::split_paths(&path_var).collect::<Vec<_>>();
                    paths.insert(0, ffmpeg_dir);
                    if let Ok(new_path) = std::env::join_paths(paths) {
                        child_cmd.env("PATH", new_path);
                    }
                }
            } else {
                // Development fallback: using exe path to walk up to workspace root
                let exe_dir = std::env::current_exe()
                    .unwrap_or_else(|_| PathBuf::from("."))
                    .parent()
                    .unwrap_or_else(|| std::path::Path::new("."))
                    .to_path_buf();
                
                // If we are running from target/release or target/debug, we can find src-backend relative to exe_dir
                // Typical exe_dir: target/debug or target/release
                let workspace_root = exe_dir.join("..").join("..").join("..");  
                let mut backend_dir = workspace_root.join("src-backend");

                if !backend_dir.exists() {
                    // Fallback to current_dir
                    backend_dir = std::env::current_dir()
                        .unwrap_or_default()
                        .join("..")
                        .join("src-backend");
                }

                if !backend_dir.exists() {
                    let err_msg = serde_json::json!({"type": "error", "message": format!("Could not find src-backend at {:?}", backend_dir)});
                    on_event(err_msg);
                    return;
                }

                child_cmd = Command::new("uv");
                child_cmd
                    .arg("run")
                    .arg("cli.py")
                    .arg("--port")
                    .arg(port.to_string())
                    .current_dir(backend_dir);
            }

            // Don't pipe stdout anymore, just hide the window on Windows.
            #[cfg(target_os = "windows")]
            {
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                use std::os::windows::process::CommandExt;
                child_cmd.creation_flags(CREATE_NO_WINDOW);
            }

            let mut child = match child_cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    let err_msg = serde_json::json!({"type": "error", "message": format!("Failed to spawn STT backend: {}", e)});
                    on_event(err_msg);
                    return;
                }
            };

            let rt = match tokio::runtime::Runtime::new() {
                Ok(rt) => rt,
                Err(e) => {
                    let err_msg = serde_json::json!({"type": "error", "message": format!("Failed to create tokio runtime: {}", e)});
                    on_event(err_msg);
                    let _ = child.kill();
                    return;
                }
            };

            let url = format!("http://127.0.0.1:{}/api/v1/stt/transcribe", port);
            let mut is_server_up = false;

            // Wait for FastAPI server to boot
            for _ in 0..20 {
                if let Ok(Some(status)) = child.try_wait() {
                    let err_msg = serde_json::json!({"type": "error", "message": format!("Python backend crashed during boot with status: {}", status)});
                    on_event(err_msg);
                    return;
                }

                let check_url = url.replace("/api/v1/stt/transcribe", "/docs");
                let is_ok = rt.block_on(async {
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                    reqwest::get(&check_url).await.is_ok()
                });

                if is_ok {
                    is_server_up = true;
                    break;
                }
            }

            if !is_server_up {
                let err_msg = serde_json::json!({"type": "error", "message": "Python backend failed to start within timeout."});
                on_event(err_msg);
                let _ = child.kill();
                return;
            }

            rt.block_on(async {
                let client = Client::new();
                let req_body = serde_json::json!({
                    "video_path": video_path,
                    "model": model_size,
                    "device": "auto",
                    "compute_type": "default",
                    "language": "auto"
                });

                let builder = client.post(&url).json(&req_body);
                let mut es = match EventSource::new(builder) {
                    Ok(source) => source,
                    Err(e) => {
                        on_event(serde_json::json!({"type": "error", "message": format!("Failed to connect to SSE: {}", e)}));
                        return;
                    }
                };

                while let Some(event) = es.next().await {
                    match event {
                        Ok(Event::Open) => { /* Connection open */ }
                        Ok(Event::Message(message)) => {
                            if let Ok(mut json) = serde_json::from_str::<serde_json::Map<String, Value>>(&message.data) {
                                // Add the event type to the JSON payload so the frontend can route it properly
                                json.insert("type".to_string(), Value::String(message.event.clone()));
                                on_event(Value::Object(json));
                            }
                        }
                        Err(reqwest_eventsource::Error::StreamEnded) => {
                            break;
                        }
                        Err(e) => {
                            let err_msg = serde_json::json!({"type": "error", "message": format!("SSE Connection error: {:?}", e)});
                            on_event(err_msg);
                            break;
                        }
                    }
                }
            });
            
            // Clean up child process
            let _ = child.kill();
            let _ = child.wait();
        });
        
        Ok(())
    }
}
