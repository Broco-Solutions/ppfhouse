import { describe, expect, it } from "vitest";

import {
  classifyDuplicate,
  normalizeComparableName,
} from "@/modules/clients/domain/client-vehicle-flow";

const existing = {
  displayName: "Juan Pérez",
  email: "juan@example.com",
  normalizedPhone: "5493415550182",
};

describe("client duplicate classification", () => {
  it("classifies normalized phone and case-insensitive email as strong", () => {
    expect(
      classifyDuplicate(existing, { phone: "+54 9 341 555-0182" }),
    ).toEqual({ strength: "strong", reasons: ["phone"] });
    expect(classifyDuplicate(existing, { email: "JUAN@EXAMPLE.COM" })).toEqual({
      strength: "strong",
      reasons: ["email"],
    });
  });

  it("suggests accent and case variants without blocking by name", () => {
    expect(normalizeComparableName("  JUAN   PEREZ ")).toBe("juan perez");
    expect(classifyDuplicate(existing, { displayName: "JUAN PEREZ" })).toEqual({
      strength: "suggestion",
      reasons: ["name"],
    });
  });

  it("does not classify legitimate different names", () => {
    expect(
      classifyDuplicate(existing, { displayName: "Juan Pérez Gómez" }),
    ).toBeNull();
  });
});
