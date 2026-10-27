import { describe, expect, it } from "vitest";

import { resolveSuggestedPrice } from "@/modules/services/domain/pricing";
import {
  serviceInputSchema,
  variantInputSchema,
} from "@/modules/services/domain/service-schema";

const variants = [
  {
    id: "suv",
    type: "VEHICLE_CLASS" as const,
    vehicleClass: "SUV" as const,
    priceUsd: "550.00",
    priority: 0,
    active: true,
  },
  {
    id: "raptor",
    type: "MODEL_EXCEPTION" as const,
    matchBrand: "Ford",
    matchModel: "Raptor",
    priceUsd: "720.00",
    priority: 0,
    active: true,
  },
];

describe("service catalog pricing", () => {
  it("prefers an exact model exception over the vehicle class", () => {
    expect(
      resolveSuggestedPrice({
        basePriceUsd: "450.00",
        variants,
        vehicle: { brand: "ford", model: "RAPTOR", vehicleClass: "SUV" },
      }),
    ).toMatchObject({
      priceUsd: "720.00",
      source: "MODEL_EXCEPTION",
      variantId: "raptor",
    });
  });

  it("falls back to class, base and finally a quote", () => {
    expect(
      resolveSuggestedPrice({
        basePriceUsd: "450.00",
        variants,
        vehicle: { brand: "BMW", model: "X5", vehicleClass: "SUV" },
      }).priceUsd,
    ).toBe("550.00");
    expect(
      resolveSuggestedPrice({
        basePriceUsd: "450.00",
        variants: [],
        vehicle: { brand: "BMW", model: "M3" },
      }).source,
    ).toBe("BASE");
    expect(
      resolveSuggestedPrice({
        variants: [],
        vehicle: { brand: "BMW", model: "M3" },
      }).source,
    ).toBe("TO_QUOTE");
  });

  it("accepts a service without price and rejects incomplete variants", () => {
    expect(
      serviceInputSchema.safeParse({
        categoryId: crypto.randomUUID(),
        name: "Cerámico",
      }).success,
    ).toBe(true);
    expect(
      variantInputSchema.safeParse({
        type: "MODEL_EXCEPTION",
        label: "Raptor",
        priceUsd: "720",
      }).success,
    ).toBe(false);
  });
});
