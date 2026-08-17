import { describe, expect, it } from "vitest";
import { buildVCard } from "./index";

describe("vcard public API", () => {
  it("exposes buildVCard, producing a valid vCard 3.0 document", () => {
    const result = buildVCard({ displayName: "Jane Tan" }, {});

    expect(result).toContain("BEGIN:VCARD");
    expect(result).toContain("VERSION:3.0");
    expect(result).toContain("FN:Jane Tan");
  });
});
