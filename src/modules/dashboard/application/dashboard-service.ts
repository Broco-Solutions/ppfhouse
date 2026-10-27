import { getSalarySummary } from "@/modules/salaries/application/salary-service";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { caseBalance, netCash } from "@/modules/finance/domain/balance";
import {
  businessDayRange,
  businessMonthRange,
  getBusinessDateKey,
  getBusinessMonthKey,
} from "@/shared/date-time/business-time";

export async function getOperationalDashboard(now = new Date()) {
  const day = businessDayRange(getBusinessDateKey(now));
  const [todayAppointments, upcomingAppointments, recentJobs, inventory] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          status: "CONFIRMED",
          startAt: { lt: day.end },
          endAt: { gt: day.start },
        },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          serviceCase: {
            select: {
              client: { select: { displayName: true } },
              vehicle: { select: { brand: true, model: true } },
            },
          },
          services: { select: { nameSnapshot: true } },
        },
        orderBy: { startAt: "asc" },
      }),
      prisma.appointment.findMany({
        where: { status: "CONFIRMED", startAt: { gte: day.end } },
        select: {
          id: true,
          startAt: true,
          serviceCase: {
            select: {
              client: { select: { displayName: true } },
              vehicle: { select: { brand: true, model: true } },
            },
          },
        },
        orderBy: { startAt: "asc" },
        take: 5,
      }),
      prisma.job.findMany({
        where: { voidedAt: null },
        select: {
          id: true,
          performedAt: true,
          serviceCase: {
            select: {
              client: { select: { displayName: true } },
              vehicle: { select: { brand: true, model: true } },
            },
          },
          _count: { select: { photos: { where: { deletedAt: null } } } },
        },
        orderBy: { performedAt: "desc" },
        take: 5,
      }),
      prisma.inventoryItem.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          currentStock: true,
          minimumStock: true,
          baseUnit: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);
  return {
    todayAppointments,
    upcomingAppointments,
    recentJobs,
    lowStock: inventory
      .filter((item) => item.currentStock.lte(item.minimumStock))
      .slice(0, 8),
  };
}

function customerCash(
  entries: ReadonlyArray<{
    direction: "INFLOW" | "OUTFLOW";
    type: string;
    amountUsd: Prisma.Decimal;
    reversalOf: { type: string } | null;
  }>,
) {
  return entries.reduce((total, entry) => {
    const originalType = entry.reversalOf?.type;
    const isCustomer =
      entry.type === "CUSTOMER_PAYMENT" ||
      entry.type === "CUSTOMER_REFUND" ||
      (entry.type === "REVERSAL" &&
        (originalType === "CUSTOMER_PAYMENT" ||
          originalType === "CUSTOMER_REFUND"));
    if (!isCustomer) return total;
    return entry.direction === "INFLOW"
      ? total.plus(entry.amountUsd)
      : total.minus(entry.amountUsd);
  }, new Prisma.Decimal(0));
}

export async function getAdminDashboard(now = new Date()) {
  const month = getBusinessMonthKey(now);
  const range = businessMonthRange(month);
  const todayDate = new Date(`${getBusinessDateKey(now)}T00:00:00.000Z`);
  const [entries, jobsThisMonth, cases, expiredQuotes, salaries] =
    await Promise.all([
      prisma.financialEntry.findMany({
        where: { occurredAt: { gte: range.start, lt: range.end } },
        select: {
          direction: true,
          type: true,
          amountUsd: true,
          reversalOf: { select: { type: true } },
        },
      }),
      prisma.job.count({
        where: {
          voidedAt: null,
          performedAt: { gte: range.start, lt: range.end },
        },
      }),
      prisma.serviceCase.findMany({
        where: { jobs: { some: { voidedAt: null } } },
        select: {
          id: true,
          agreedAmountUsd: true,
          directCostUsd: true,
          client: { select: { displayName: true } },
          vehicle: { select: { brand: true, model: true } },
          jobs: {
            where: {
              voidedAt: null,
              performedAt: { gte: range.start, lt: range.end },
            },
            select: { id: true },
            orderBy: { performedAt: "desc" },
            take: 1,
          },
          financialEntries: {
            select: { direction: true, amountUsd: true },
          },
        },
      }),
      prisma.quote.findMany({
        where: { status: "SENT", validUntil: { lt: todayDate } },
        select: {
          id: true,
          number: true,
          validUntil: true,
          client: { select: { displayName: true } },
        },
        orderBy: { validUntil: "asc" },
        take: 5,
      }),
      getSalarySummary(now),
    ]);
  const cashNet = netCash(entries);
  const collected = customerCash(entries);
  const outflows = entries.reduce(
    (total, entry) =>
      entry.direction === "OUTFLOW" ? total.plus(entry.amountUsd) : total,
    new Prisma.Decimal(0),
  );
  const monthCases = cases.filter((serviceCase) => serviceCase.jobs.length);
  const pricedMonthCases = monthCases.filter(
    (serviceCase) => serviceCase.agreedAmountUsd !== null,
  );
  const agreedTotal = pricedMonthCases.reduce(
    (total, serviceCase) => total.plus(serviceCase.agreedAmountUsd!),
    new Prisma.Decimal(0),
  );
  const casesWithKnownMargin = monthCases.filter(
    (serviceCase) =>
      serviceCase.agreedAmountUsd !== null &&
      serviceCase.directCostUsd !== null,
  );
  const knownMarginUsd = casesWithKnownMargin.reduce(
    (total, serviceCase) =>
      total
        .plus(serviceCase.agreedAmountUsd!)
        .minus(serviceCase.directCostUsd!),
    new Prisma.Decimal(0),
  );
  const costCount = monthCases.filter(
    (serviceCase) => serviceCase.directCostUsd !== null,
  ).length;
  const pendingCases = cases
    .filter((serviceCase) => serviceCase.agreedAmountUsd !== null)
    .map((serviceCase) => ({
      ...serviceCase,
      balance: caseBalance(
        serviceCase.agreedAmountUsd,
        serviceCase.financialEntries,
      ).balanceUsd!,
    }))
    .filter((serviceCase) => serviceCase.balance.gt(0))
    .sort((a, b) => b.balance.comparedTo(a.balance));
  return {
    month,
    collectedUsd: collected,
    outflowUsd: outflows,
    cashNetUsd: cashNet,
    salaries,
    jobsThisMonth,
    knownMarginUsd,
    marginCaseCount: casesWithKnownMargin.length,
    caseCount: monthCases.length,
    costCount,
    averageAgreedUsd: pricedMonthCases.length
      ? agreedTotal.dividedBy(pricedMonthCases.length)
      : new Prisma.Decimal(0),
    pendingBalanceUsd: pendingCases.reduce(
      (total, serviceCase) => total.plus(serviceCase.balance),
      new Prisma.Decimal(0),
    ),
    pendingCases: pendingCases.slice(0, 5),
    undefinedAmountCases: cases
      .filter((serviceCase) => serviceCase.agreedAmountUsd === null)
      .slice(0, 5),
    expiredQuotes,
  };
}
