import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB-backed repository; the route's own logic (slug gate, content-type
// sniff, ETag, 304) is what we exercise here.
vi.mock("@/features/card/repository", () => ({
  getPublicCardPhotoBySlug: vi.fn(),
}));

import { getPublicCardPhotoBySlug } from "@/features/card/repository";
import { GET } from "./route";

const mockGetPhoto = vi.mocked(getPublicCardPhotoBySlug);
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function context(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function request(headers?: Record<string, string>): Request {
  return new Request("https://namecard.example.com/avatar/jane.tan", { headers });
}

beforeEach(() => {
  mockGetPhoto.mockReset();
});

describe("GET /avatar/[slug]", () => {
  it("404s an invalid slug without hitting the database", async () => {
    const response = await GET(request(), context("Invalid Slug!"));

    expect(response.status).toBe(404);
    expect(mockGetPhoto).not.toHaveBeenCalled();
  });

  it("404s when the card has no resolvable photo", async () => {
    mockGetPhoto.mockResolvedValue(null);

    const response = await GET(request(), context("jane.tan"));

    expect(response.status).toBe(404);
  });

  it("serves the photo with a sniffed content-type and an ETag", async () => {
    mockGetPhoto.mockResolvedValue(PNG_BYTES);

    const response = await GET(request(), context("jane.tan"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(response.headers.get("ETag")).toMatch(/^"[0-9a-f]{32}"$/);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it("returns 304 when the client's If-None-Match matches the current ETag", async () => {
    mockGetPhoto.mockResolvedValue(PNG_BYTES);

    const first = await GET(request(), context("jane.tan"));
    const etag = first.headers.get("ETag")!;

    const second = await GET(request({ "if-none-match": etag }), context("jane.tan"));

    expect(second.status).toBe(304);
    expect(second.headers.get("ETag")).toBe(etag);
    expect(await second.text()).toBe("");
  });
});
