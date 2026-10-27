import { describe, expect, it } from "vitest";

import {
  MAX_PHOTO_BYTES,
  photoIntentSchema,
} from "@/modules/photos/domain/photo-schema";

describe("photo upload schema", () => {
  it("accepts supported image metadata within limits", () => {
    expect(
      photoIntentSchema.safeParse({
        jobId: crypto.randomUUID(),
        fileName: "bmw-m3-before.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2_000_000,
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported types and oversized files", () => {
    const base = {
      jobId: crypto.randomUUID(),
      fileName: "capture.heic",
      sizeBytes: 1_000,
    };
    expect(
      photoIntentSchema.safeParse({ ...base, mimeType: "image/heic" }).success,
    ).toBe(false);
    expect(
      photoIntentSchema.safeParse({
        ...base,
        mimeType: "image/jpeg",
        sizeBytes: MAX_PHOTO_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});
