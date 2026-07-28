use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use crate::domain::job::{Job, JobStatus};
use crate::domain::project::{TaskType, PipelineTask, TaskStatus};
use crate::domain::events::EventDispatcher;
use serde_json::Value;

pub struct JobManager {
    current_job: Mutex<Option<Job>>,
    cancel_token: Arc<AtomicBool>,
}

impl JobManager {
    pub fn new() -> Self {
        Self {
            current_job: Mutex::new(None),
            cancel_token: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn get_current_job(&self) -> Option<Job> {
        self.current_job.lock().unwrap().clone()
    }

    pub fn is_running(&self) -> bool {
        if let Some(job) = self.current_job.lock().unwrap().as_ref() {
            job.status == JobStatus::Pending || job.status == JobStatus::Running
        } else {
            false
        }
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancel_token.load(Ordering::SeqCst)
    }

    pub fn add_tasks(&self, task_types: Vec<TaskType>, dispatcher: Arc<dyn EventDispatcher>) -> Result<String, String> {
        let mut job_lock = self.current_job.lock().map_err(|e| e.to_string())?;
        
        // Always reset the cancel token when adding new tasks
        self.cancel_token.store(false, Ordering::SeqCst);

        let current = job_lock.take();
        
        if let Some(mut job) = current {
            // Revive job from dismissed state
            job.is_dismissed = false;
            // Re-activate job if it was in a terminal state
            if job.status == JobStatus::Completed || job.status == JobStatus::Error || job.status == JobStatus::Cancelled {
                job.status = JobStatus::Pending;
                job.error_message = None;
            }

            for task_type in task_types.clone() {
                // If we add a task, any existing task with a higher order index should be Outdated!
                for t in &mut job.tasks {
                    if t.task_type.order_index() > task_type.order_index() {
                        if t.status == TaskStatus::Completed {
                            t.status = TaskStatus::Outdated;
                        }
                    }
                }
                
                if !job.tasks.iter().any(|t| t.task_type == task_type) {
                    job.tasks.push(PipelineTask {
                        task_type: task_type.clone(),
                        status: TaskStatus::Pending,
                        progress: 0.0,
                        error_message: None,
                    });
                } else {
                    for task in &mut job.tasks {
                        if task.task_type == task_type {
                            task.status = TaskStatus::Pending;
                            task.progress = 0.0;
                            task.error_message = None;
                        }
                    }
                }
            }
            
            // Sort tasks by order_index to maintain the correct fixed sequence
            job.tasks.sort_by_key(|t| t.task_type.order_index());
            
            let id = job.id.clone();
            *job_lock = Some(job);
            
            let _ = dispatcher.emit("job-state-changed", Value::Null);
            return Ok(id);
        } else {
            // Create a new job if none exists
            let mut pipeline_tasks: Vec<PipelineTask> = task_types.into_iter().map(|task_type| PipelineTask {
                task_type,
                status: TaskStatus::Pending,
                progress: 0.0,
                error_message: None,
            }).collect();
            
            pipeline_tasks.sort_by_key(|t| t.task_type.order_index());

            let new_job = Job::new(pipeline_tasks);
            let id = new_job.id.clone();
            *job_lock = Some(new_job);
            
            let _ = dispatcher.emit("job-state-changed", Value::Null);
            return Ok(id);
        }
    }

    pub fn start_new_job(&self, task_types: Vec<TaskType>, dispatcher: Arc<dyn EventDispatcher>) -> Result<String, String> {
        let mut job_lock = self.current_job.lock().map_err(|e| e.to_string())?;
        
        self.cancel_token.store(false, Ordering::SeqCst);

        let mut pipeline_tasks: Vec<PipelineTask> = task_types.into_iter().map(|task_type| PipelineTask {
            task_type,
            status: TaskStatus::Pending,
            progress: 0.0,
            error_message: None,
        }).collect();
        
        pipeline_tasks.sort_by_key(|t| t.task_type.order_index());

        let new_job = Job::new(pipeline_tasks);
        let id = new_job.id.clone();
        *job_lock = Some(new_job);
        
        let _ = dispatcher.emit("job-state-changed", Value::Null);
        Ok(id)
    }

    pub fn get_next_pending_task(&self) -> Option<TaskType> {
        if let Some(job) = self.current_job.lock().unwrap().as_mut() {
            if job.status == JobStatus::Pending || job.status == JobStatus::Running {
                for task in &job.tasks {
                    if task.status == TaskStatus::Pending {
                        return Some(task.task_type.clone());
                    }
                }
            }
        }
        None
    }

    pub fn update_task_progress(&self, task_type: TaskType, progress: f64, dispatcher: Arc<dyn EventDispatcher>) {
        if let Some(job) = self.current_job.lock().unwrap().as_mut() {
            job.status = JobStatus::Running;
            for task in &mut job.tasks {
                if task.task_type == task_type {
                    if task.status != TaskStatus::Completed && task.status != TaskStatus::Error && task.status != TaskStatus::Cancelled {
                        task.status = TaskStatus::Running;
                        task.progress = progress;
                    }
                }
            }
        }
        let _ = dispatcher.emit("job-state-changed", Value::Null);
    }

    pub fn complete_task(&self, task_type: TaskType, dispatcher: Arc<dyn EventDispatcher>) {
        if let Some(job) = self.current_job.lock().unwrap().as_mut() {
            for task in &mut job.tasks {
                if task.task_type == task_type {
                    task.status = TaskStatus::Completed;
                    task.progress = 100.0;
                }
            }
            
            let any_active = job.tasks.iter().any(|t| t.status == TaskStatus::Pending || t.status == TaskStatus::Running);
            if !any_active {
                let any_error = job.tasks.iter().any(|t| t.status == TaskStatus::Error);
                if any_error {
                    job.status = JobStatus::Error;
                } else {
                    job.status = JobStatus::Completed;
                }
            }
        }
        let _ = dispatcher.emit("job-state-changed", Value::Null);
    }

    pub fn fail_job(&self, error_message: String, dispatcher: Arc<dyn EventDispatcher>) {
        if let Some(job) = self.current_job.lock().unwrap().as_mut() {
            job.status = JobStatus::Error;
            job.error_message = Some(error_message.clone());
            
            // Mark all running/pending tasks as error/cancelled
            for task in &mut job.tasks {
                if task.status == TaskStatus::Running || task.status == TaskStatus::Pending {
                    task.status = TaskStatus::Error;
                    task.error_message = Some(error_message.clone());
                }
            }
        }
        let _ = dispatcher.emit("job-state-changed", Value::Null);
    }

    pub fn cancel_job(&self, dispatcher: Arc<dyn EventDispatcher>) {
        self.cancel_token.store(true, Ordering::SeqCst);
        if let Some(job) = self.current_job.lock().unwrap().as_mut() {
            job.status = JobStatus::Cancelled;
            for task in &mut job.tasks {
                if task.status == TaskStatus::Running || task.status == TaskStatus::Pending {
                    task.status = TaskStatus::Cancelled;
                }
            }
        }
        let _ = dispatcher.emit("job-state-changed", Value::Null);
    }

    pub fn dismiss_job(&self, dispatcher: Arc<dyn EventDispatcher>) {
        let mut job_lock = self.current_job.lock().unwrap();
        if let Some(job) = job_lock.as_mut() {
            if job.status == JobStatus::Completed || job.status == JobStatus::Error || job.status == JobStatus::Cancelled {
                job.is_dismissed = true;
            }
        }
        let _ = dispatcher.emit("job-state-changed", Value::Null);
    }
}
