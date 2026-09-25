use super::token::MorphemeToken;
use super::tokenizer::katakana_to_hiragana;

pub trait DictionarySchema: Send + Sync {
    fn extract_morpheme(&self, surface: &str, details: &[&str]) -> MorphemeToken;
    fn apply_phonological_rules(&self, tokens: &mut [MorphemeToken]);
}

pub struct UnidicSchema;

impl UnidicSchema {
    pub fn new() -> Self {
        Self
    }

    /// Converts a leading 'ha' line kana to 'pa' line (半濁音化)
    fn apply_handakuon(kana: &str) -> String {
        let mut chars: Vec<char> = kana.chars().collect();
        if let Some(first) = chars.first_mut() {
            *first = match *first {
                'は' => 'ぱ',
                'ひ' => 'ぴ',
                'ふ' => 'ぷ',
                'へ' => 'ぺ',
                'ほ' => 'ぽ',
                other => other,
            };
        }
        chars.into_iter().collect()
    }

    /// Converts the trailing kana to sokuon 'っ' (促音化)
    fn apply_sokuon(kana: &str) -> String {
        let mut chars: Vec<char> = kana.chars().collect();
        if let Some(last) = chars.last_mut() {
            *last = 'っ';
        }
        chars.into_iter().collect()
    }
}

impl Default for UnidicSchema {
    fn default() -> Self {
        Self::new()
    }
}

impl DictionarySchema for UnidicSchema {
    fn extract_morpheme(&self, surface: &str, details: &[&str]) -> MorphemeToken {
        let pos = details.first().copied().unwrap_or("*").to_string();
        let sub_pos = details.get(1).copied().unwrap_or("*").to_string();

        let base_form = details
            .get(10)
            .or_else(|| details.get(7))
            .copied()
            .filter(|s| !s.is_empty() && *s != "*")
            .unwrap_or(surface)
            .to_string();

        let reading_hiragana = details
            .get(9)
            .copied()
            .filter(|s| !s.is_empty() && *s != "*")
            .map(katakana_to_hiragana);

        let head_change = details
            .get(13)
            .copied()
            .filter(|s| !s.is_empty() && *s != "*")
            .map(|s| s.to_string());

        let tail_change = details
            .get(15)
            .copied()
            .filter(|s| !s.is_empty() && *s != "*")
            .map(|s| s.to_string());

        MorphemeToken {
            surface: surface.to_string(),
            base_form,
            reading_hiragana,
            pos,
            sub_pos,
            head_change,
            tail_change,
        }
    }

    fn apply_phonological_rules(&self, tokens: &mut [MorphemeToken]) {
        if tokens.is_empty() {
            return;
        }

        // Standard UniDic Numeral + Counter euphony (促音便 / 半濁音便) based strictly on UniDic fields 13 & 15
        for i in 0..tokens.len().saturating_sub(1) {
            let has_sokuon_tail = tokens[i].tail_change.as_deref().map_or(false, |tc| tc.contains('促'));
            let has_handaku_head = tokens[i + 1].head_change.as_deref().map_or(false, |hc| hc.contains("半濁"));

            if has_sokuon_tail && has_handaku_head {
                // Apply 促音便 to token[i] (e.g. "いち" -> "いっ")
                if let Some(r) = &tokens[i].reading_hiragana {
                    tokens[i].reading_hiragana = Some(Self::apply_sokuon(r));
                }
                // Apply 半濁音化 to token[i+1] (e.g. "はく" -> "ぱく", "ほん" -> "ぽん")
                if let Some(r) = &tokens[i + 1].reading_hiragana {
                    tokens[i + 1].reading_hiragana = Some(Self::apply_handakuon(r));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unidic_schema_rules() {
        let schema = UnidicSchema::new();
        let mut tokens = vec![
            MorphemeToken {
                surface: "一".into(),
                base_form: "一".into(),
                reading_hiragana: Some("いち".into()),
                pos: "名詞".into(),
                sub_pos: "数詞".into(),
                head_change: None,
                tail_change: Some("チ促".into()),
            },
            MorphemeToken {
                surface: "泊".into(),
                base_form: "泊".into(),
                reading_hiragana: Some("はく".into()),
                pos: "名詞".into(),
                sub_pos: "助数詞可能".into(),
                head_change: Some("ハ半濁".into()),
                tail_change: None,
            },
        ];

        schema.apply_phonological_rules(&mut tokens);
        assert_eq!(tokens[0].reading_hiragana.as_deref(), Some("いっ"));
        assert_eq!(tokens[1].reading_hiragana.as_deref(), Some("ぱく"));
    }
}
