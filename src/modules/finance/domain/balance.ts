import { Prisma } from "@/generated/prisma/client";

export interface SignedEntry {
  direction: "INFLOW" | "OUTFLOW";
  amountUsd: Prisma.Decimal | string;
}

export function netCash(entries: readonly SignedEntry[]) {
  return entries.reduce(
    (total, entry) =>
      entry.direction === "INFLOW"
        ? total.plus(entry.amountUsd)
        : total.minus(entry.amountUsd),
    new Prisma.Decimal(0),
  );
}

export function caseBalance(
  agreedAmountUsd: Prisma.Decimal | string | null,
  entries: readonly SignedEntry[],
) {
  const collectedUsd = netCash(entries);
  return {
    agreedAmountUsd:
      agreedAmountUsd === null ? null : new Prisma.Decimal(agreedAmountUsd),
    collectedUsd,
    balanceUsd:
      agreedAmountUsd === null
        ? null
        : new Prisma.Decimal(agreedAmountUsd).minus(collectedUsd),
  };
}
