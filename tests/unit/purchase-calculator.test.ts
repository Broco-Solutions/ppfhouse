import { describe, expect, it } from "vitest";

import {
  calculatePurchaseLine,
  sumPurchaseTotal,
} from "@/modules/purchases/domain/purchase-calculator";

describe("purchase calculation", () => {
  it("converts two 15 meter rolls into 30 exact base meters", () => {
    const line = calculatePurchaseLine({
      quantityPurchased: "2",
      factorToBase: "15",
      unitCostUsd: "600",
    });
    expect(line.quantityBase.toFixed(3)).toBe("30.000");
    expect(line.totalUsd.toFixed(2)).toBe("1200.00");
  });

  it("rounds each commercial line to cents before summing", () => {
    const a = calculatePurchaseLine({
      quantityPurchased: "1.5",
      factorToBase: "1",
      unitCostUsd: "10.11",
    });
    const b = calculatePurchaseLine({
      quantityPurchased: "2",
      factorToBase: "1",
      unitCostUsd: "3.25",
    });
    expect(a.totalUsd.toFixed(2)).toBe("15.17");
    expect(sumPurchaseTotal([a, b]).toFixed(2)).toBe("21.67");
  });
});
