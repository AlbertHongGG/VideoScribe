#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MorphemeToken {
    pub surface: String,
    pub base_form: String,
    pub reading_hiragana: Option<String>,
    pub pos: String,
    pub sub_pos: String,
    pub head_change: Option<String>,
    pub tail_change: Option<String>,
}

impl MorphemeToken {
    pub fn has_kanji(&self) -> bool {
        self.surface.chars().any(|c| (0x4E00..=0x9FAF).contains(&(c as u32)))
    }
}
