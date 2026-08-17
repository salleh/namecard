import { describe, expect, it } from "vitest";
import { foldLine } from "./lineFold";

describe("foldLine", () => {
  it("returns lines at or under 75 octets unchanged", () => {
    const line = `NOTE:${"a".repeat(70)}`; // 75 octets total

    const result = foldLine(line);

    expect(result).toBe(line);
    expect(result).not.toContain("\r\n");
  });

  it("folds a line over 75 octets, with continuation lines starting with a single space", () => {
    const line = `NOTE:${"a".repeat(100)}`; // 105 octets total

    const result = foldLine(line);
    const physicalLines = result.split("\r\n");

    expect(physicalLines.length).toBeGreaterThan(1);
    physicalLines.slice(1).forEach((continuation) => {
      expect(continuation.startsWith(" ")).toBe(true);
    });
  });

  it("keeps every physical line within 75 octets (leading space counted for continuations)", () => {
    const line = `NOTE:${"a".repeat(200)}`;

    const result = foldLine(line);
    const physicalLines = result.split("\r\n");

    physicalLines.forEach((physicalLine) => {
      expect(new TextEncoder().encode(physicalLine).length).toBeLessThanOrEqual(75);
    });
  });

  it("reassembles (after stripping the fold whitespace) to the original content", () => {
    const line = `NOTE:${"a".repeat(160)}`;

    const result = foldLine(line);
    const unfolded = result
      .split("\r\n")
      .map((physicalLine, index) => (index === 0 ? physicalLine : physicalLine.slice(1)))
      .join("");

    expect(unfolded).toBe(line);
  });

  it("does not split a multi-byte UTF-8 character across a fold boundary", () => {
    // Repeated multi-byte characters so a naive byte-count split would land
    // mid-character.
    const line = `NOTE:${"€".repeat(60)}`; // well over 75 octets (3 bytes each)

    const result = foldLine(line);
    const unfolded = result
      .split("\r\n")
      .map((physicalLine, index) => (index === 0 ? physicalLine : physicalLine.slice(1)))
      .join("");

    expect(unfolded).toBe(line);
    expect(unfolded).not.toContain("�"); // no replacement character from a broken split
  });
});
