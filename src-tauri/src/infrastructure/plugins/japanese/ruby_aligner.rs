use crate::domain::language::RubySegment;

pub struct RubyAligner;

impl RubyAligner {
    /// 檢查文字中是否含有漢字 (Unicode range 4E00-9FAF)
    pub fn has_kanji(text: &str) -> bool {
        text.chars().any(|c| {
            let code = c as u32;
            (0x4E00..=0x9FAF).contains(&code)
        })
    }

    /// 將包含漢字與送假名的單詞 (如「食べる」與「たべる」) 精準對齊為 RubySegment 列表
    pub fn align(surface: &str, reading_hiragana: &str) -> Vec<RubySegment> {
        // 若表面無漢字，直接輸出單一 Text 段落，無須注音
        if !Self::has_kanji(surface) {
            return vec![RubySegment::text(surface)];
        }

        let surface_chars: Vec<char> = surface.chars().collect();
        let reading_chars: Vec<char> = reading_hiragana.chars().collect();

        // 1. 計算前後假名相同綴詞長度 (Prefix & Suffix Trimming)
        let mut prefix_len = 0;
        while prefix_len < surface_chars.len()
            && prefix_len < reading_chars.len()
            && surface_chars[prefix_len] == reading_chars[prefix_len]
            && !Self::is_kanji(surface_chars[prefix_len])
        {
            prefix_len += 1;
        }

        let mut suffix_len = 0;
        while suffix_len < (surface_chars.len() - prefix_len)
            && suffix_len < (reading_chars.len() - prefix_len)
            && surface_chars[surface_chars.len() - 1 - suffix_len]
                == reading_chars[reading_chars.len() - 1 - suffix_len]
            && !Self::is_kanji(surface_chars[surface_chars.len() - 1 - suffix_len])
        {
            suffix_len += 1;
        }

        let mut segments = Vec::new();

        // 前綴平假名 (如「お茶」的「お」)
        if prefix_len > 0 {
            let prefix_surface: String = surface_chars[..prefix_len].iter().collect();
            segments.push(RubySegment::text(prefix_surface));
        }

        // 漢字核心部分 (如「食べる」的「食」對應「た」，「一泊」對應「いっぱく」)
        let kanji_surface: String = surface_chars[prefix_len..surface_chars.len() - suffix_len]
            .iter()
            .collect();
        let kanji_reading: String = reading_chars[prefix_len..reading_chars.len() - suffix_len]
            .iter()
            .collect();

        if !kanji_surface.is_empty() {
            if Self::has_kanji(&kanji_surface) {
                segments.push(RubySegment::ruby(kanji_surface, kanji_reading));
            } else {
                segments.push(RubySegment::text(kanji_surface));
            }
        }

        // 後綴送假名 (如「食べる」的「べる」)
        if suffix_len > 0 {
            let suffix_surface: String = surface_chars[surface_chars.len() - suffix_len..]
                .iter()
                .collect();
            segments.push(RubySegment::text(suffix_surface));
        }

        segments
    }

    fn is_kanji(c: char) -> bool {
        let code = c as u32;
        (0x4E00..=0x9FAF).contains(&code)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ruby_aligner() {
        // 1. 完全漢字詞 (一泊 -> いっぱく)
        let res = RubyAligner::align("一泊", "いっぱく");
        assert_eq!(res.len(), 1);
        assert_eq!(res[0], RubySegment::ruby("一泊", "いっぱく"));

        // 2. 帶送假名動詞 (食べる -> 食[た] + べる)
        let res = RubyAligner::align("食べる", "たべる");
        assert_eq!(res.len(), 2);
        assert_eq!(res[0], RubySegment::ruby("食", "た"));
        assert_eq!(res[1], RubySegment::text("べる"));

        // 3. 帶送假名形容詞 (美味しく -> 美味[おい] + しく)
        let res = RubyAligner::align("美味しく", "おいしく");
        assert_eq!(res.len(), 2);
        assert_eq!(res[0], RubySegment::ruby("美味", "おい"));
        assert_eq!(res[1], RubySegment::text("しく"));

        // 4. 無漢字 (フリーサイト)
        let res = RubyAligner::align("フリーサイト", "ふりーさいと");
        assert_eq!(res.len(), 1);
        assert_eq!(res[0], RubySegment::text("フリーサイト"));
    }
}
