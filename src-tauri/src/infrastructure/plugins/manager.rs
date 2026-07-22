use std::any::{Any, TypeId};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use crate::infrastructure::plugins::japanese::JapanesePlugin;

pub struct PluginManager {
    services: HashMap<(TypeId, String), Arc<dyn Any + Send + Sync>>,
}

impl PluginManager {
    /// Create a new empty PluginManager IoC container.
    pub fn empty() -> Self {
        Self {
            services: HashMap::new(),
        }
    }

    /// Initialize PluginManager with built-in default plugins.
    pub fn new(app: &AppHandle) -> Self {
        let mut manager = Self::empty();

        if let Err(err) = JapanesePlugin::register(app, &mut manager) {
            eprintln!("Failed to initialize Japanese plugin: {}", err);
        }

        manager
    }

    /// Generic service registration API.
    /// `T` is the Trait Object type, e.g. `dyn FuriganaProvider`.
    pub fn register_service<T: ?Sized + 'static>(&mut self, key: &str, service: Arc<T>)
    where
        Arc<T>: Send + Sync + 'static,
    {
        let type_id = TypeId::of::<Arc<T>>();
        self.services.insert((type_id, key.to_string()), Arc::new(service));
    }

    /// Generic service lookup API.
    /// `T` is the Trait Object type, e.g. `dyn FuriganaProvider`.
    pub fn get_service<T: ?Sized + 'static>(&self, key: &str) -> Option<Arc<T>>
    where
        Arc<T>: Send + Sync + 'static,
    {
        let type_id = TypeId::of::<Arc<T>>();
        let any_arc = self.services.get(&(type_id, key.to_string()))?;
        let downcasted = any_arc.downcast_ref::<Arc<T>>()?;
        Some(downcasted.clone())
    }
}
