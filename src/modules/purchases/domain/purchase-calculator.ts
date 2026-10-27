import { Prisma } from "@/generated/prisma/client";
import { presentationToBase } from "@/modules/inventory/domain/stock";

export function calculatePurchaseLine(input: {
  quantityPurchased: Prisma.Decimal | string;
  factorToBase: Prisma.Decimal | string;
  unitCostUsd: Prisma.Decimal | string;
}) {
  const quantityPurchased = new Prisma.Decimal(input.quantityPurchased);
  const factorToBase = new Prisma.Decimal(input.factorToBase);
  const unitCostUsd = new Prisma.Decimal(input.unitCostUsd);
  return {
    quantityPurchased,
    factorToBase,
    quantityBase: presentationToBase(quantityPurchased, factorToBase),
    unitCostUsd,
    totalUsd: quantityPurchased
      .mul(unitCostUsd)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  };
}

export function sumPurchaseTotal(
  lines: readonly { totalUsd: Prisma.Decimal }[],
) {
  return lines.reduce(
    (total, line) => total.plus(line.totalUsd),
    new Prisma.Decimal(0),
  );
}
