// RFC 2426 §5.8.4 TEXT value escaping. Order matters: backslashes must be
// escaped first so the escape sequences introduced by the later passes
// (`\n`, `\,`, `\;`) are not themselves re-escaped.
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
