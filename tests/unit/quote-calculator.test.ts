import { describe, expect, it } from "vitest";

import { calculateQuote } from "@/modules/quotes/domain/quote-calculator";

describe("quote calculator", () => {
  it("calculates source ARS values and canonical USD values with one rate", () => {
    const result = calculateQuote(
      [
        {
          name: "Trabajo",
          quantity: "1",
          unitPriceUsd: "780000",
          discountUsd: "0",
        },
      ],
      "0",
      "ARS",
      "1560",
    );
    expect(result.items[0]?.sourceTotal).toBe("780000.00");
    expect(result.items[0]?.totalUsd).toBe("500.00");
    expect(result.totalUsd).toBe("500.00");
  });
  it("rounds each item commercially and applies line and global discounts", () => {
    const result = calculateQuote(
      [
        {
          name: "Cerámico",
          quantity: "2",
          unitPriceUsd: "450",
          discountUsd: "50",
        },
        {
          name: "PPF",
          quantity: "1.125",
          unitPriceUsd: "100",
          discountUsd: "0",
        },
      ],
      "12.50",
    );
    expect(result.items.map((item) => item.totalUsd)).toEqual([
      "850.00",
      "112.50",
    ]);
    expect(result).toMatchObject({
      subtotalUsd: "962.50",
      discountUsd: "12.50",
      totalUsd: "950.00",
    });
  });

  it("rejects discounts larger than their source amount", () => {
    expect(() =>
      calculateQuote(
        [
          {
            name: "Item",
            quantity: "1",
            unitPriceUsd: "10",
            discountUsd: "11",
          },
        ],
        "0",
      ),
    ).toThrow("ITEM_DISCOUNT_EXCEEDS_GROSS");
    expect(() =>
      calculateQuote(
        [{ name: "Item", quantity: "1", unitPriceUsd: "10", discountUsd: "0" }],
        "11",
      ),
    ).toThrow("GLOBAL_DISCOUNT_EXCEEDS_SUBTOTAL");
  });
});
