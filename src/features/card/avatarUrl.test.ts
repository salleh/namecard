import { describe, expect, it } from "vitest";
import { avatarUrl } from "./avatarUrl";

describe("avatarUrl", () => {
  it("builds an absolute avatar URL from origin and slug", () => {
    expect(avatarUrl("https://namecard.example.com", "jane.tan")).toBe(
      "https://namecard.example.com/avatar/jane.tan",
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(avatarUrl("https://namecard.example.com/", "jane.tan")).toBe(
      "https://namecard.example.com/avatar/jane.tan",
    );
  });
});
