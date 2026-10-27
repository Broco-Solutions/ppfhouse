import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  presentationToBase,
  sumInventoryMovements,
} from "@/modules/inventory/domain/stock";

describe("inventory decimals", () => {
  it("converts an explicit roll factor without binary floating point", () => {
    expect(presentationToBase("2", "15").toFixed(3)).toBe("30.000");
    expect(presentationToBase("0.5", "15").toFixed(3)).toBe("7.500");
  });

  it("rejects a conversion that cannot fit stock precision", () => {
    expect(() => presentationToBase("0.3333", "2.5")).toThrow();
  });

  it("reconciles exact signed movements", () => {
    const stock = sumInventoryMovements([
      { signedQuantityBase: new Prisma.Decimal("30.000") },
      { signedQuantityBase: "-2.425" },
      { signedQuantityBase: "0.125" },
    ]);
    expect(stock.toFixed(3)).toBe("27.700");
  });
});
