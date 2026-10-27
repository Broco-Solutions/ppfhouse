import { describe, expect, it } from "vitest";

import {
  addConsumptionSchema,
  correctConsumptionSchema,
} from "@/modules/job-consumptions/domain/consumption-schema";

describe("job consumption schema", () => {
  it("accepts exact base quantities with up to three decimals", () => {
    expect(
      addConsumptionSchema.safeParse({
        jobId: crypto.randomUUID(),
        itemId: crypto.randomUUID(),
        quantityBase: "3.200",
        note: "PPF frontal",
        idempotencyKey: crypto.randomUUID(),
      }).success,
    ).toBe(true);
  });

  it("rejects zero, negative and excessive precision", () => {
    const base = {
      consumptionId: crypto.randomUUID(),
      reason: "Corrección de medición",
      idempotencyKey: crypto.randomUUID(),
    };
    expect(
      correctConsumptionSchema.safeParse({ ...base, quantityBase: "0" })
        .success,
    ).toBe(false);
    expect(
      correctConsumptionSchema.safeParse({ ...base, quantityBase: "-1" })
        .success,
    ).toBe(false);
    expect(
      correctConsumptionSchema.safeParse({ ...base, quantityBase: "1.2345" })
        .success,
    ).toBe(false);
  });
});
