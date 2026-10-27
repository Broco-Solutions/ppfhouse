import { Prisma } from "@/generated/prisma/client";

export function sumInventoryMovements(
  movements: readonly { signedQuantityBase: Prisma.Decimal | string }[],
) {
  return movements.reduce(
    (total, movement) =>
      total.plus(new Prisma.Decimal(movement.signedQuantityBase)),
    new Prisma.Decimal(0),
  );
}

export function presentationToBase(
  purchasedQuantity: Prisma.Decimal | string,
  factorToBase: Prisma.Decimal | string,
) {
  const result = new Prisma.Decimal(purchasedQuantity).mul(factorToBase);
  if (result.decimalPlaces() > 3) throw new Error("BASE_QUANTITY_PRECISION");
  return result;
}
