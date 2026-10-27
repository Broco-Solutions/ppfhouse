import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { caseBalance } from "@/modules/finance/domain/balance";

interface AggregatedCashRow {
  serviceCaseId: string;
  collectedUsd: Prisma.Decimal;
}

export async function reconcileServiceCaseFinances() {
  const [serviceCases, aggregates] = await Promise.all([
    prisma.serviceCase.findMany({
      select: {
        id: true,
        agreedAmountUsd: true,
        financialEntries: {
          select: { direction: true, amountUsd: true },
        },
      },
    }),
    prisma.$queryRaw<AggregatedCashRow[]>(Prisma.sql`
      SELECT
        sc."id" AS "serviceCaseId",
        COALESCE(
          SUM(
            CASE
              WHEN fe."direction" = 'INFLOW' THEN fe."amountUsd"
              WHEN fe."direction" = 'OUTFLOW' THEN -fe."amountUsd"
              ELSE 0
            END
          ),
          0
        )::DECIMAL(19,2) AS "collectedUsd"
      FROM "service_cases" sc
      LEFT JOIN "financial_entries" fe ON fe."serviceCaseId" = sc."id"
      GROUP BY sc."id"
    `),
  ]);
  const aggregateByCase = new Map(
    aggregates.map((row) => [row.serviceCaseId, row.collectedUsd]),
  );

  return serviceCases.map((serviceCase) => {
    const balance = caseBalance(
      serviceCase.agreedAmountUsd,
      serviceCase.financialEntries,
    );
    const aggregatedCollected =
      aggregateByCase.get(serviceCase.id) ?? new Prisma.Decimal(0);
    return {
      serviceCaseId: serviceCase.id,
      ...balance,
      aggregatedCollectedUsd: aggregatedCollected,
      matches: balance.collectedUsd.equals(aggregatedCollected),
    };
  });
}
