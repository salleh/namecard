// @vitest-environment node
// Photo upload is pure server logic. Run it under Node (not jsdom) so File/Blob
// carry the real `arrayBuffer()` the Next.js server runtime provides — jsdom's
// File omits it.
import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, readPhotoUpload } from "./photoUpload";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

function fileOf(bytes: number[], name = "photo.png", type = "image/png"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function formWith(file: File | null, removeFlag = false): FormData {
  const fd = new FormData();
  if (file) fd.set("photo", file);
  if (removeFlag) fd.set("removePhoto", "on");
  return fd;
}

describe("readPhotoUpload", () => {
  it("returns action 'keep' when no file is provided", async () => {
    expect(await readPhotoUpload(formWith(null))).toEqual({ ok: true, action: "keep" });
  });

  it("returns action 'keep' for a zero-byte file (empty file input)", async () => {
    expect(await readPhotoUpload(formWith(fileOf([])))).toEqual({ ok: true, action: "keep" });
  });

  it("returns action 'remove' when the remove flag is set", async () => {
    expect(await readPhotoUpload(formWith(null, true))).toEqual({ ok: true, action: "remove" });
  });

  it("prefers removal even if a file is also present", async () => {
    const result = await readPhotoUpload(formWith(fileOf(PNG_MAGIC), true));

    expect(result).toEqual({ ok: true, action: "remove" });
  });

  it("accepts a valid PNG and returns its bytes", async () => {
    const result = await readPhotoUpload(formWith(fileOf(PNG_MAGIC)));

    expect(result.ok).toBe(true);
    if (!result.ok || result.action !== "replace") throw new Error("expected replace");
    expect(Array.from(result.bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("accepts a valid JPEG", async () => {
    const result = await readPhotoUpload(formWith(fileOf(JPEG_MAGIC, "p.jpg", "image/jpeg")));

    expect(result.ok).toBe(true);
    if (!result.ok || result.action !== "replace") throw new Error("expected replace");
  });

  it("accepts a valid GIF", async () => {
    const result = await readPhotoUpload(formWith(fileOf(GIF_MAGIC, "p.gif", "image/gif")));

    expect(result.ok).toBe(true);
    if (!result.ok || result.action !== "replace") throw new Error("expected replace");
  });

  it("rejects a file whose bytes are not a known image (magic-byte sniff, not declared type)", async () => {
    const notAnImage = fileOf([0x25, 0x50, 0x44, 0x46], "evil.png", "image/png"); // %PDF

    const result = await readPhotoUpload(formWith(notAnImage));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/image/i);
  });

  it("rejects a file larger than the size cap", async () => {
    const huge = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "big.png", { type: "image/png" });

    const result = await readPhotoUpload(formWith(huge));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/too large|size/i);
  });
});
