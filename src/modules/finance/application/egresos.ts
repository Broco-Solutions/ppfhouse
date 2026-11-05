import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { identity } from "./consolidado";

const expenseTypes = ["PURCHASE", "MANUAL_EXPENSE", "SALARY_PAYMENT"] as const;
type ExpenseType = (typeof expenseTypes)[number];

export async function getConsolidatedExpenses(
  range: { start: Date; end: Date },
  page = 1,
) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000)
    throw new Error("INVALID_PAGE");
  const where: Prisma.FinancialEntryWhereInput = {
    occurredAt: { gte: range.start, lt: range.end },
    OR: [
      { type: { in: [...expenseTypes] } },
      {
        type: "REVERSAL",
        reversalOf: { is: { type: { in: [...expenseTypes] } } },
      },
    ],
  };
  // One read snapshot keeps totals, count and page consistent during concurrent payments.
  return prisma.$transaction(
    async (tx) => {
      const totals: Prisma.Decimal[] = [];
      for (const type of expenseTypes) {
        const groups = await tx.financialEntry.groupBy({
          by: ["direction"],
          where: {
            occurredAt: where.occurredAt,
            OR: [{ type }, { type: "REVERSAL", reversalOf: { is: { type } } }],
          },
          _sum: { amountUsd: true },
        });
        totals.push(
          groups.reduce((sum, group) => {
            const amount = group._sum.amountUsd ?? new Prisma.Decimal(0);
            return group.direction === "OUTFLOW"
              ? sum.plus(amount)
              : sum.minus(amount);
          }, new Prisma.Decimal(0)),
        );
      }
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
        totales: {
          compras: totals[0]!.toFixed(2),
          gastosManuales: totals[1]!.toFixed(2),
          sueldosPagados: totals[2]!.toFixed(2),
          egresos: totals
            .reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0))
            .toFixed(2),
        },
        movimientos: entries.map((entry) => ({
          id: entry.id,
          fecha: entry.occurredAt.toISOString(),
          tipo: (entry.type === "REVERSAL"
            ? entry.reversalOf!.type
            : entry.type) as ExpenseType,
          reversion: entry.type === "REVERSAL",
          importeUsd: (entry.direction === "OUTFLOW"
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
