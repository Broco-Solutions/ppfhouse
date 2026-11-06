import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { identity } from "./consolidado";

const collectionTypes = ["CUSTOMER_PAYMENT", "CUSTOMER_REFUND"] as const;
type CollectionType = (typeof collectionTypes)[number];

export async function getConsolidatedCollections(
  range: { start: Date; end: Date },
  page = 1,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
    throw new Error("INVALID_PAGE");
  // Keep this selection identical to summary(): effective customer cash only.
  const where: Prisma.FinancialEntryWhereInput = {
    occurredAt: { gte: range.start, lt: range.end },
    OR: [
      { type: { in: [...collectionTypes] } },
      {
        type: "REVERSAL",
        reversalOf: { is: { type: { in: [...collectionTypes] } } },
      },
    ],
  };
  // Count and page share one read snapshot, as in consolidated expenses.
  return prisma.$transaction(
    async (tx) => {
      const total = await tx.financialEntry.count({ where });
      const entries = await tx.financialEntry.findMany({
        where,
        select: {
          id: true,
          occurredAt: true,
          type: true,
          direction: true,
          amountUsd: true,
          reversalOf: { select: { type: true } },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 25,
        take: 25,
      });
      const totalPaginas = Math.max(1, Math.ceil(total / 25));
      return {
        ...identity,
        periodo: {
          desde: range.start.toISOString(),
          hasta: new Date(range.end.getTime() - 1).toISOString(),
        },
        movimientos: entries.map((entry) => ({
          id: entry.id,
          fecha: entry.occurredAt.toISOString(),
          tipo: (entry.type === "REVERSAL"
            ? entry.reversalOf!.type
            : entry.type) as CollectionType,
          reversion: entry.type === "REVERSAL",
          importeUsd: (entry.direction === "INFLOW"
            ? entry.amountUsd
            : entry.amountUsd.negated()
          ).toFixed(2),
        })),
        paginacion: {
          pagina: page,
          porPagina: 25,
          total,
          totalPaginas,
          hayMas: page < totalPaginas,
        },
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
