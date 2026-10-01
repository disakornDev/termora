/// Reassembles UTF-8 byte sequences across PTY read boundaries.
///
/// A PTY read returns whatever bytes happen to be available in the OS buffer, so a multi-byte
/// character (such as Thai script, box-drawing characters, or emojis) can be split across two reads.
/// Decoding each read individually would emit replacement characters (\u{FFFD}).
/// Trailing bytes that do not yet form a complete character are carried over into the next read.
#[derive(Default)]
pub struct Utf8StreamDecoder {
    carry: Vec<u8>,
}

impl Utf8StreamDecoder {
    pub fn new() -> Self {
        Self { carry: Vec::new() }
    }

    pub fn decode(&mut self, chunk: &[u8]) -> String {
        self.carry.extend_from_slice(chunk);
        let mut decoded = String::new();

        loop {
            match std::str::from_utf8(&self.carry) {
                Ok(text) => {
                    decoded.push_str(text);
                    self.carry.clear();
                    return decoded;
                }
                Err(err) => {
                    let valid_up_to = err.valid_up_to();
                    if valid_up_to > 0 {
                        decoded.push_str(
                            std::str::from_utf8(&self.carry[..valid_up_to])
                                .expect("prefix was reported valid"),
                        );
                    }

                    match err.error_len() {
                        // Incomplete multi-byte sequence at the end of the buffer.
                        // Retain the remaining bytes and wait for the next read chunk.
                        None => {
                            self.carry.drain(..valid_up_to);
                            return decoded;
                        }
                        // Genuinely invalid bytes: emit replacement character and continue decoding.
                        Some(invalid_len) => {
                            decoded.push('\u{FFFD}');
                            self.carry.drain(..valid_up_to + invalid_len);
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ascii_and_multibyte_split() {
        let mut decoder = Utf8StreamDecoder::new();

        // "สวัสดี" in UTF-8:
        // ส: [224, 184, 176]
        // ว: [224, 184, 167]
        // ั: [224, 184, 177]
        // ส: [224, 184, 176]
        // ด: [224, 184, 163]
        // ี: [224, 185, 133]
        let thai_bytes = "สวัสดี".as_bytes();

        // Split "ส" across chunks: first 2 bytes, then 3rd byte + rest
        let chunk1 = &thai_bytes[..2];
        let chunk2 = &thai_bytes[2..];

        let out1 = decoder.decode(chunk1);
        assert_eq!(out1, ""); // Nothing emitted yet since character was incomplete

        let out2 = decoder.decode(chunk2);
        assert_eq!(out2, "สวัสดี"); // Full text emitted when remainder arrives
    }
}
