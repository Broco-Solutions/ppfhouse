import { describe, expect, it } from "vitest";

import {
  directJobSchema,
  voidJobSchema,
} from "@/modules/jobs/domain/job-schema";

describe("job schemas", () => {
  it("allows a direct job without payment, services or employees", () => {
    expect(
      directJobSchema.parse({
        clientId: crypto.randomUUID(),
        vehicleId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        performedLocal: "2026-10-02T18:30",
      }),
    ).toMatchObject({ serviceIds: [], employeeIds: [] });
  });

  it("requires a meaningful reason to void a job", () => {
    expect(
      voidJobSchema.safeParse({ jobId: crypto.randomUUID(), reason: "x" })
        .success,
    ).toBe(false);
  });
});
