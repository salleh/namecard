import { describe, expect, it } from "vitest";
import { escapeText } from "./textEscape";

describe("escapeText", () => {
  it("escapes commas", () => {
    const value = "Sales, Marketing";

    const result = escapeText(value);

    expect(result).toBe("Sales\\, Marketing");
  });

  it("escapes semicolons", () => {
    const value = "Floor 3; Wing B";

    const result = escapeText(value);

    expect(result).toBe("Floor 3\\; Wing B");
  });

  it("escapes backslashes before introducing any new escape sequences", () => {
    const value = "C:\\Users\\staff";

    const result = escapeText(value);

    expect(result).toBe("C:\\\\Users\\\\staff");
  });

  it("converts newlines to the literal \\n token", () => {
    const value = "Line one\nLine two";

    const result = escapeText(value);

    expect(result).toBe("Line one\\nLine two");
  });

  it("normalizes CRLF newlines to a single literal \\n token", () => {
    const value = "Line one\r\nLine two";

    const result = escapeText(value);

    expect(result).toBe("Line one\\nLine two");
  });

  it("escapes backslash, comma, semicolon, and newline together in the correct order", () => {
    const value = "a,b;c\\d\ne";

    const result = escapeText(value);

    expect(result).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("returns an empty string unchanged", () => {
    const result = escapeText("");

    expect(result).toBe("");
  });

  it("leaves text with no special characters unchanged", () => {
    const result = escapeText("Jane Tan");

    expect(result).toBe("Jane Tan");
  });
});
