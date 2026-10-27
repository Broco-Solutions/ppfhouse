import { describe, expect, it } from "vitest";

import { caseBalance, netCash } from "@/modules/finance/domain/balance";
import { businessMonthRange } from "@/shared/date-time/business-time";

describe("finance calculations", () => {
  it("derives collected cash and balance without binary floats", () => {
    const entries = [
      { direction: "INFLOW" as const, amountUsd: "200.10" },
      { direction: "INFLOW" as const, amountUsd: "300.20" },
      { direction: "OUTFLOW" as const, amountUsd: "50.05" },
    ];
    expect(netCash(entries).toFixed(2)).toBe("450.25");
    expect(caseBalance("1000.00", entries).balanceUsd?.toFixed(2)).toBe(
      "549.75",
    );
  });

  it("keeps an undefined agreed amount distinct from zero balance", () => {
    const result = caseBalance(null, [
      { direction: "INFLOW", amountUsd: "100.00" },
    ]);
    expect(result.collectedUsd.toFixed(2)).toBe("100.00");
    expect(result.balanceUsd).toBeNull();
  });

  it("allows a negative balance to represent credit in favor", () => {
    expect(
      caseBalance("100.00", [
        { direction: "INFLOW", amountUsd: "120.00" },
      ]).balanceUsd?.toFixed(2),
    ).toBe("-20.00");
  });

  it("uses Buenos Aires boundaries for monthly cash", () => {
    expect(businessMonthRange("2026-10")).toEqual({
      start: new Date("2026-10-01T03:00:00.000Z"),
      end: new Date("2026-11-01T03:00:00.000Z"),
    });
    expect(businessMonthRange("2008-01")).toEqual({
      start: new Date("2008-01-01T02:00:00.000Z"),
      end: new Date("2008-02-01T02:00:00.000Z"),
    });
  });
});
