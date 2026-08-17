// RFC 2425 §5.8.1 line folding: a content line (name + params + value) must
// not exceed 75 octets, excluding the terminating CRLF. Longer lines are
// split into multiple physical lines, each continuation line beginning with
// a single leading SPACE. Folding is octet-based (not character-based) per
// the RFC, so this operates on UTF-8 bytes and backs off to the nearest
// character boundary rather than splitting a multi-byte sequence in half.
const MAX_LINE_OCTETS = 75;
const CONTINUATION_OCTETS = MAX_LINE_OCTETS - 1; // reserve 1 octet for the leading space

export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= MAX_LINE_OCTETS) {
    return line;
  }

  const decoder = new TextDecoder();
  const segments: string[] = [];
  let start = 0;
  let budget = MAX_LINE_OCTETS;

  while (start < bytes.length) {
    const end = findSegmentEnd(bytes, start, budget);
    segments.push(decoder.decode(bytes.slice(start, end)));
    start = end;
    budget = CONTINUATION_OCTETS;
  }

  return segments.map((segment, index) => (index === 0 ? segment : ` ${segment}`)).join("\r\n");
}

// Back off from the naive byte-count boundary until it doesn't land inside a
// multi-byte UTF-8 sequence (continuation bytes match the `10xxxxxx` pattern).
function findSegmentEnd(bytes: Uint8Array, start: number, budget: number): number {
  let end = Math.min(start + budget, bytes.length);
  while (end > start && end < bytes.length) {
    const byte = bytes[end];
    const isContinuationByte = byte !== undefined && (byte & 0xc0) === 0x80;
    if (!isContinuationByte) break;
    end--;
  }
  return end;
}
