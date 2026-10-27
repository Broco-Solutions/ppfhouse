import { describe, expect, it } from "vitest";

import {
  clientInputSchema,
  normalizePhone,
  vehicleInputSchema,
} from "@/modules/clients/domain/client-schema";

describe("client and vehicle validation", () => {
  it("normalizes phone numbers without making them mandatory", () => {
    expect(normalizePhone("+54 9 341 555-0182")).toBe("5493415550182");
    expect(normalizePhone(undefined)).toBeNull();
    expect(
      clientInputSchema.parse({ displayName: "Juan — BMW M3" }).phone,
    ).toBeUndefined();
  });

  it("keeps operational fields short and rejects implausible vehicle years", () => {
    expect(
      vehicleInputSchema.safeParse({ brand: "BMW", model: "M3", year: "2024" })
        .success,
    ).toBe(true);
    expect(
      vehicleInputSchema.safeParse({ brand: "BMW", model: "M3", year: "1800" })
        .success,
    ).toBe(false);
  });
});
