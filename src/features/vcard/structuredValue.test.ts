import { describe, expect, it } from "vitest";
import { joinTrimTrailingEmpty } from "./structuredValue";

describe("joinTrimTrailingEmpty", () => {
  it("joins non-empty components with semicolons", () => {
    const result = joinTrimTrailingEmpty(["Example Org", "Marketing"]);

    expect(result).toBe("Example Org;Marketing");
  });

  it("drops trailing empty components", () => {
    const result = joinTrimTrailingEmpty(["Example Org", "", ""]);

    expect(result).toBe("Example Org");
  });

  it("preserves interior empty components", () => {
    const result = joinTrimTrailingEmpty(["Example Org", "", "Level 3"]);

    expect(result).toBe("Example Org;;Level 3");
  });

  it("returns an empty string when every component is empty", () => {
    const result = joinTrimTrailingEmpty(["", "", ""]);

    expect(result).toBe("");
  });

  it("returns an empty string for an empty component list", () => {
    const result = joinTrimTrailingEmpty([]);

    expect(result).toBe("");
  });
});
