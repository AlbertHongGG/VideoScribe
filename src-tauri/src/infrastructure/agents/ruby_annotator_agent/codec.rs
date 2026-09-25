use crate::domain::language::RubySegment;

pub struct RubyCodec;

impl RubyCodec {
    /// Serializes a slice of RubySegments into the compact DSL: e.g. "[一日]{いちにち}[本]{ほん}にいます"
    pub fn to_compact(segments: &[RubySegment]) -> String {
        let mut s = String::new();
        for seg in segments {
            match seg {
                RubySegment::Text { text } => s.push_str(text),
                RubySegment::Ruby { base, ruby } => {
                    s.push('[');
                    s.push_str(base);
                    s.push_str("]{");
                    s.push_str(ruby);
                    s.push('}');
                }
            }
        }
        s
    }

    /// Parses a compact DSL string into a Vec<RubySegment>.
    /// Pattern: `[BaseText]{RubyText}` becomes a RubySegment::Ruby.
    /// Everything outside of valid `[...]{...}` blocks becomes a RubySegment::Text.
    pub fn from_compact(input: &str) -> Result<Vec<RubySegment>, String> {
        let mut segments = Vec::new();
        let mut current_text = String::new();
        let mut chars = input.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '[' {
                let mut base = String::new();
                let mut found_bracket_close = false;

                while let Some(&bc) = chars.peek() {
                    if bc == ']' {
                        chars.next();
                        found_bracket_close = true;
                        break;
                    } else {
                        base.push(bc);
                        chars.next();
                    }
                }

                if found_bracket_close && chars.peek() == Some(&'{') {
                    chars.next(); // consume '{'
                    let mut ruby = String::new();
                    let mut found_brace_close = false;

                    while let Some(&rc) = chars.peek() {
                        if rc == '}' {
                            chars.next();
                            found_brace_close = true;
                            break;
                        } else {
                            ruby.push(rc);
                            chars.next();
                        }
                    }

                    if found_brace_close {
                        if !current_text.is_empty() {
                            segments.push(RubySegment::Text {
                                text: std::mem::take(&mut current_text),
                            });
                        }
                        segments.push(RubySegment::Ruby { base, ruby });
                        continue;
                    } else {
                        // Unclosed `{...`: fallback to treating as literal text
                        current_text.push('[');
                        current_text.push_str(&base);
                        current_text.push_str("]{");
                        current_text.push_str(&ruby);
                    }
                } else {
                    // Not followed by `{`: fallback to treating as literal text
                    current_text.push('[');
                    current_text.push_str(&base);
                    if found_bracket_close {
                        current_text.push(']');
                    }
                }
            } else {
                current_text.push(c);
            }
        }

        if !current_text.is_empty() {
            segments.push(RubySegment::Text { text: current_text });
        }

        Ok(segments)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_compact_and_from_compact_roundtrip() {
        let original = vec![
            RubySegment::Ruby { base: "一日".into(), ruby: "いちにち".into() },
            RubySegment::Ruby { base: "本".into(), ruby: "ほん".into() },
            RubySegment::Text { text: "にいます".into() },
        ];

        let compact = RubyCodec::to_compact(&original);
        assert_eq!(compact, "[一日]{いちにち}[本]{ほん}にいます");

        let decoded = RubyCodec::from_compact(&compact).expect("Should decode successfully");
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_plain_text_without_ruby() {
        let text = "こんにちは、世界！123 ABC";
        let decoded = RubyCodec::from_compact(text).unwrap();
        assert_eq!(decoded.len(), 1);
        assert_eq!(decoded[0], RubySegment::Text { text: text.into() });
    }

    #[test]
    fn test_literal_brackets_preserved() {
        let text = "[BGM] [一日]{いちにち} [拍手]";
        let decoded = RubyCodec::from_compact(text).unwrap();
        assert_eq!(decoded.len(), 3);
        assert_eq!(decoded[0], RubySegment::Text { text: "[BGM] ".into() });
        assert_eq!(decoded[1], RubySegment::Ruby { base: "一日".into(), ruby: "いちにち".into() });
        assert_eq!(decoded[2], RubySegment::Text { text: " [拍手]".into() });
    }
}
