use std::any::Any;
use crate::domain::language::Language;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PluginType {
    Language(Language),
    Global(String),
}

/// The unified base trait for all VideoScribe plugins.
pub trait Plugin: Send + Sync + 'static {
    /// Returns the type/category key of this plugin.
    fn plugin_type(&self) -> PluginType;

    /// Returns the human-readable name of this plugin.
    fn name(&self) -> &str;

    /// Provides std::any::Any downcasting capability for concrete types.
    fn as_any(&self) -> &dyn Any;
}
