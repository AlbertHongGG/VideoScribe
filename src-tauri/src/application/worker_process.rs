use std::io::{BufRead, BufReader, Write};
use std::process::{Command, ChildStdin, Child, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::path::PathBuf;

use crate::domain::ipc_models::{WorkerCommand, WorkerEvent};

type EventCallback = Arc<dyn Fn(WorkerEvent) + Send + Sync>;

pub struct WorkerProcess {
    stdin: Mutex<Option<ChildStdin>>,
    child_process: Mutex<Option<Child>>,
    on_event: EventCallback,
}

impl WorkerProcess {
    pub fn new(on_event: EventCallback) -> Arc<Self> {
        let process = Arc::new(Self {
            stdin: Mutex::new(None),
            child_process: Mutex::new(None),
            on_event,
        });
        
        process.spawn_worker();
        process
    }

    pub fn restart_worker(&self) {
        println!("Restarting worker process...");
        {
            let mut child_guard = self.child_process.lock().unwrap();
            if let Some(mut child) = child_guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
            *self.stdin.lock().unwrap() = None;
        }
        self.spawn_worker();
    }

    fn spawn_worker(&self) {
        let exe_dir = std::env::current_exe()
            .unwrap_or_else(|_| PathBuf::from("."))
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .to_path_buf();
        
        let workspace_root = exe_dir.join("..").join("..").join("..");  
        let mut backend_dir = workspace_root.join("src-backend");

        if !backend_dir.exists() {
            backend_dir = std::env::current_dir()
                .unwrap_or_default()
                .join("..")
                .join("src-backend");
        }
        
        let mut child_cmd = Command::new("uv");
        child_cmd
            .arg("run")
            .arg("python")
            .arg("-m")
            .arg("videoscribe.worker")
            .env("PYTHONUTF8", "1")
            .current_dir(&backend_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            use std::os::windows::process::CommandExt;
            child_cmd.creation_flags(CREATE_NO_WINDOW);
        }

        match child_cmd.spawn() {
            Ok(mut child) => {
                let stdin = child.stdin.take().expect("Failed to open stdin");
                let stdout = child.stdout.take().expect("Failed to open stdout");

                *self.stdin.lock().unwrap() = Some(stdin);
                
                let on_event = self.on_event.clone();
                
                thread::spawn(move || {
                    let reader = BufReader::new(stdout);
                    for line_result in reader.lines() {
                        if let Ok(line) = line_result {
                            match serde_json::from_str::<WorkerEvent>(&line) {
                                Ok(event) => on_event(event),
                                Err(_) => {}
                            }
                        }
                    }
                    println!("Python worker stdout closed. Worker process exited.");
                    // Synthesize an internal error event
                    use crate::domain::ipc_models::{WorkerEventData, ErrorData};
                    on_event(WorkerEvent {
                        version: 1,
                        data: WorkerEventData::Error(ErrorData {
                            message: "Worker process died unexpectedly".to_string()
                        })
                    });
                });

                *self.child_process.lock().unwrap() = Some(child);
            }
            Err(e) => {
                eprintln!("Failed to spawn Python worker: {}", e);
            }
        }
    }

    pub fn send_command(&self, command: &WorkerCommand) -> Result<(), String> {
        let mut stdin_guard = self.stdin.lock().unwrap();
        if let Some(stdin) = stdin_guard.as_mut() {
            let mut line = serde_json::to_string(command).map_err(|e| e.to_string())?;
            line.push('\n');
            stdin.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
            stdin.flush().map_err(|e| e.to_string())?;
            Ok(())
        } else {
            Err("Worker process is not running".to_string())
        }
    }
}
