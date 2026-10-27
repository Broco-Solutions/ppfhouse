import { describe, expect, it } from "vitest";

import {
  calculateQuoteSummary,
  formatQuoteMoney,
} from "@/modules/quotes/domain/quote-summary";

describe("quote live summary", () => {
  it("applies line discounts before the general discount exactly once", () => {
    expect(
      calculateQuoteSummary(
        [
          { quantity: "2", unitPriceUsd: "3000", discountUsd: "154" },
          { quantity: "1", unitPriceUsd: "1000", discountUsd: "0" },
        ],
        "1000",
        "",
      ),
    ).toEqual({
      subtotal: 6846,
      discount: 1000,
      total: 5846,
      totalUsd: null,
    });
  });

  it("updates the ARS USD equivalent and formats es-AR", () => {
    const result = calculateQuoteSummary(
      [{ quantity: "1", unitPriceUsd: "780000", discountUsd: "0" }],
      "0",
      "1560",
    );
    expect(result.totalUsd).toBe(500);
    expect(formatQuoteMoney(result.total, "ARS")).toBe("ARS 780.000,00");
    expect(formatQuoteMoney(result.totalUsd!, "USD")).toBe("USD 500,00");
  });
});
