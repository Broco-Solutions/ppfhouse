import { describe, expect, it } from "vitest";

import { appointmentReassignmentEligibility } from "@/modules/scheduling/domain/appointment-reassignment";

const safe = {
  origin: "DIRECT_APPOINTMENT" as const,
  acceptedQuoteId: null,
  agreedAmountUsd: null,
  agreedSourceCurrency: null,
  agreedSourceAmount: null,
  agreedExchangeRateArsPerUsd: null,
  directCostUsd: null,
  directCostSourceCurrency: null,
  directCostSourceAmount: null,
  directCostExchangeRateArsPerUsd: null,
  appointmentCount: 1,
  jobCount: 0,
  financialEntryCount: 0,
  amountRevisionCount: 0,
};

describe("appointment identity reassignment", () => {
  it("allows a direct appointment without downstream history", () => {
    expect(appointmentReassignmentEligibility(safe)).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it.each([
    { financialEntryCount: 1 },
    { jobCount: 1 },
    { amountRevisionCount: 1 },
    { agreedAmountUsd: "100.00" },
    { directCostUsd: "10.00" },
    { acceptedQuoteId: "quote-id", origin: "ACCEPTED_QUOTE" as const },
  ])("blocks commercial or historical dependencies: %o", (patch) => {
    expect(
      appointmentReassignmentEligibility({ ...safe, ...patch }).allowed,
    ).toBe(false);
  });

  it("blocks a shared case with another appointment", () => {
    expect(
      appointmentReassignmentEligibility({ ...safe, appointmentCount: 2 })
        .allowed,
    ).toBe(false);
  });
});
