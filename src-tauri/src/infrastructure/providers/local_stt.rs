use crate::domain::stt::STTProvider;
use serde_json::Value;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

pub struct LocalSTTProvider;

impl LocalSTTProvider {
    pub fn new() -> Self {
        Self
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
        
        std::thread::spawn(move || {
            let exe_dir = std::env::current_exe()
                .unwrap_or_else(|_| PathBuf::from("."))
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .to_path_buf();

            let backend_exe = exe_dir.join("backend").join("VideoScribe-backend.exe");
            
            let mut child_cmd;
            
            if backend_exe.exists() {
                child_cmd = Command::new(&backend_exe);
                child_cmd
                    .arg(&video_path)
                    .arg("--model")
                    .arg(&model_size);
                    
                let ffmpeg_dir = exe_dir.join("ffmpeg").join("bin");
                if let Some(path_var) = std::env::var_os("PATH") {
                    let mut paths = std::env::split_paths(&path_var).collect::<Vec<_>>();
                    paths.insert(0, ffmpeg_dir);
                    if let Ok(new_path) = std::env::join_paths(paths) {
                        child_cmd.env("PATH", new_path);
                    }
                }
            } else {
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
                    let err_msg = serde_json::json!({"type": "error", "message": format!("Failed to spawn STT process: {}", e)});
                    on_event(err_msg);
                    return;
                }
            };

            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(line_str) = line {
                        if let Ok(json) = serde_json::from_str::<Value>(&line_str) {
                            on_event(json);
                        }
                    }
                }
            }
            
            let _ = child.wait();
        });
        
        Ok(())
    }
}
