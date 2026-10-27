import { describe, expect, it } from "vitest";

import {
  costCoverage,
  normalizeMoneyInput,
  profitability,
} from "@/modules/money/domain/money";
import { usdToArsText } from "@/modules/money/domain/money-text";

describe("canonical money and case profitability", () => {
  it("keeps USD input canonical without a rate", () => {
    const normalized = normalizeMoneyInput({ currency: "USD", amount: "500" });
    expect(normalized.amountUsd.toFixed(2)).toBe("500.00");
    expect(normalized.sourceAmount.toFixed(2)).toBe("500.00");
    expect(normalized.exchangeRateArsPerUsd).toBeNull();
  });

  it("converts ARS with decimal precision and retains the source", () => {
    const normalized = normalizeMoneyInput({
      currency: "ARS",
      amount: "780000",
      exchangeRateArsPerUsd: "1560",
    });
    expect(normalized.amountUsd.toFixed(2)).toBe("500.00");
    expect(normalized.sourceAmount.toFixed(2)).toBe("780000.00");
    expect(normalized.exchangeRateArsPerUsd?.toString()).toBe("1560");
  });

  it("handles decimal rates, half-up rounding, and large monetary values", () => {
    expect(
      normalizeMoneyInput({
        currency: "ARS",
        amount: "780250",
        exchangeRateArsPerUsd: "1560.5",
      }).amountUsd.toFixed(2),
    ).toBe("500.00");
    expect(
      normalizeMoneyInput({
        currency: "ARS",
        amount: "1",
        exchangeRateArsPerUsd: "3",
      }).amountUsd.toFixed(2),
    ).toBe("0.33");
    expect(
      normalizeMoneyInput({
        currency: "USD",
        amount: "999999999999.99",
      }).amountUsd.toFixed(2),
    ).toBe("999999999999.99");
  });

  it("converts USD catalog defaults into the selected ARS quote currency", () => {
    expect(usdToArsText("500", "1560")).toBe("780000.00");
    expect(usdToArsText("0.01", "1.5")).toBe("0.02");
  });

  it("rejects zero and negative rates and invalid amount precision", () => {
    for (const rate of ["0", "-1"]) {
      expect(() =>
        normalizeMoneyInput({
          currency: "ARS",
          amount: "100",
          exchangeRateArsPerUsd: rate,
        }),
      ).toThrow();
    }
    expect(() =>
      normalizeMoneyInput({ currency: "USD", amount: "1.001" }),
    ).toThrow("INVALID_MONEY");
    for (const amount of ["", "-1", "1,000"]) {
      expect(() => normalizeMoneyInput({ currency: "USD", amount })).toThrow();
    }
  });

  it("distinguishes unknown cost from a real zero and supports negative margin", () => {
    expect(profitability("3000", null)).toBeNull();
    expect(profitability(null, "1000")).toBeNull();
    expect(profitability("0", "0")?.marginPercent).toBeNull();
    expect(profitability("3000", "0")?.marginUsd.toFixed(2)).toBe("3000.00");
    expect(profitability("1000", "1200")?.marginUsd.toFixed(2)).toBe("-200.00");
    expect(profitability("1000", "1000")?.marginPercent?.toFixed(2)).toBe(
      "0.00",
    );
    expect(profitability("3000", "1000")?.marginPercent?.toFixed(2)).toBe(
      "66.67",
    );
  });

  it("reports partial and complete cost coverage without inferring totals", () => {
    expect(costCoverage(8, 12)).toEqual({
      costCount: 8,
      caseCount: 12,
      percentage: 66.66666666666666,
    });
    expect(costCoverage(0, 0).percentage).toBeNull();
    expect(costCoverage(12, 12).percentage).toBe(100);
  });
});
