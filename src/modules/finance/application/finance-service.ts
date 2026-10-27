import {
  lockSalary,
  reopenSalaryPayment,
} from "@/modules/salaries/application/salary-service";
import { createHash } from "node:crypto";

import {
  Prisma,
  type FinancialDirection,
  type FinancialEntryType,
} from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { caseBalance, netCash } from "@/modules/finance/domain/balance";
import { normalizeMoneyInput } from "@/modules/money/domain/money";
import {
  amountRevisionSchema,
  categoryInputSchema,
  directCostSchema,
  financialEntryInputSchema,
  type FinancialEntryInput,
} from "@/modules/finance/domain/finance-schema";
import {
  businessLocalDateTimeToUtc,
  businessMonthRange,
  getBusinessMonthKey,
} from "@/shared/date-time/business-time";

interface Actor {
  id: string;
}

function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const kindConfig: Record<
  FinancialEntryInput["kind"],
  { direction: FinancialDirection; type: FinancialEntryType }
> = {
  CUSTOMER_PAYMENT: { direction: "INFLOW", type: "CUSTOMER_PAYMENT" },
  CUSTOMER_REFUND: { direction: "OUTFLOW", type: "CUSTOMER_REFUND" },
  MANUAL_INCOME: { direction: "INFLOW", type: "MANUAL_INCOME" },
  MANUAL_EXPENSE: { direction: "OUTFLOW", type: "MANUAL_EXPENSE" },
};

export async function recordFinancialEntry(
  input: FinancialEntryInput,
  actor: Actor,
) {
  const data = financialEntryInputSchema.parse(input);
  const hash = requestHash(data);
  const config = kindConfig[data.kind];
  const occurredAt = businessLocalDateTimeToUtc(data.occurredLocal);
  const money = normalizeMoneyInput(data);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({
        where: {
          operation_key: {
            operation: "CREATE_FINANCIAL_ENTRY",
            key: data.idempotencyKey,
          },
        },
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new Error("IDEMPOTENCY_CONFLICT");
        if (!existing.resultReference)
          throw new Error("IDEMPOTENCY_INCOMPLETE");
        return { id: existing.resultReference, replayed: true };
      }

      if (data.serviceCaseId) {
        const serviceCase = await tx.serviceCase.findUnique({
          where: { id: data.serviceCaseId },
          select: { id: true },
        });
        if (!serviceCase) throw new Error("SERVICE_CASE_NOT_FOUND");
      }
      if (data.categoryId) {
        const category = await tx.financialCategory.findFirst({
          where: {
            id: data.categoryId,
            active: true,
            direction: config.direction,
          },
          select: { id: true },
        });
        if (!category) throw new Error("CATEGORY_NOT_AVAILABLE");
      }

      const entry = await tx.financialEntry.create({
        data: {
          direction: config.direction,
          type: config.type,
          amountUsd: money.amountUsd,
          sourceCurrency: money.sourceCurrency,
          sourceAmount: money.sourceAmount,
          exchangeRateArsPerUsd: money.exchangeRateArsPerUsd,
          occurredAt,
          serviceCaseId: data.serviceCaseId || null,
          categoryId: data.categoryId || null,
          paymentMethod: data.paymentMethod || null,
          description: data.description,
          createdById: actor.id,
        },
        select: { id: true },
      });
      await tx.idempotencyKey.create({
        data: {
          operation: "CREATE_FINANCIAL_ENTRY",
          key: data.idempotencyKey,
          actorId: actor.id,
          requestHash: hash,
          resultReference: entry.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return { id: entry.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: {
          operation_key: {
            operation: "CREATE_FINANCIAL_ENTRY",
            key: data.idempotencyKey,
          },
        },
      });
      if (existing?.requestHash === hash && existing.resultReference)
        return { id: existing.resultReference, replayed: true };
      if (existing) throw new Error("IDEMPOTENCY_CONFLICT");
    }
    throw error;
  }
}

export async function reverseFinancialEntry(
  input: { entryId: string; reason: string },
  actor: Actor,
) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 300)
    throw new Error("INVALID_REASON");
  try {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.financialEntry.findUnique({
        where: { id: input.entryId },
        select: {
          id: true,
          direction: true,
          type: true,
          amountUsd: true,
          sourceCurrency: true,
          sourceAmount: true,
          exchangeRateArsPerUsd: true,
          occurredAt: true,
          salaryMonthId: true,
          salaryMonth: { select: { salaryId: true } },
          serviceCaseId: true,
          categoryId: true,
          paymentMethod: true,
        },
      });
      if (!original) throw new Error("FINANCIAL_ENTRY_NOT_FOUND");
      if (original.type === "REVERSAL")
        throw new Error("REVERSAL_NOT_REVERSIBLE");
      if (original.salaryMonth)
        await lockSalary(tx, original.salaryMonth.salaryId);
      const existing = await tx.financialEntry.findUnique({
        where: { reversalOfId: original.id },
        select: { id: true },
      });
      if (existing) return { id: existing.id, replayed: true };
      const reversal = await tx.financialEntry.create({
        data: {
          direction: original.direction === "INFLOW" ? "OUTFLOW" : "INFLOW",
          type: "REVERSAL",
          amountUsd: original.amountUsd,
          sourceCurrency: original.sourceCurrency,
          sourceAmount: original.sourceAmount,
          exchangeRateArsPerUsd: original.exchangeRateArsPerUsd,
          occurredAt: new Date(),
          description: `Reversión: ${reason}`,
          serviceCaseId: original.serviceCaseId,
          categoryId: original.categoryId,
          paymentMethod: original.paymentMethod,
          salaryMonthId: original.salaryMonthId,
          reversalOfId: original.id,
          createdById: actor.id,
        },
        select: { id: true },
      });
      if (original.salaryMonthId)
        await reopenSalaryPayment(
          tx,
          original.id,
          original.salaryMonthId,
          actor,
          reason,
        );
      return { id: reversal.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.financialEntry.findUnique({
        where: { reversalOfId: input.entryId },
        select: { id: true },
      });
      if (existing) return { id: existing.id, replayed: true };
    }
    throw error;
  }
}

export async function setAgreedAmount(input: unknown, actor: Actor) {
  const data = amountRevisionSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const serviceCase = await tx.serviceCase.findUnique({
      where: { id: data.serviceCaseId },
      select: { agreedAmountUsd: true },
    });
    if (!serviceCase) throw new Error("SERVICE_CASE_NOT_FOUND");
    const money = normalizeMoneyInput(data);
    const next = money.amountUsd;
    if (serviceCase.agreedAmountUsd?.equals(next)) return { changed: false };
    const updated = await tx.serviceCase.updateMany({
      where: {
        id: data.serviceCaseId,
        agreedAmountUsd: serviceCase.agreedAmountUsd,
      },
      data: {
        agreedAmountUsd: next,
        agreedSourceCurrency: money.sourceCurrency,
        agreedSourceAmount: money.sourceAmount,
        agreedExchangeRateArsPerUsd: money.exchangeRateArsPerUsd,
      },
    });
    if (updated.count !== 1) throw new Error("AMOUNT_CONFLICT");
    await tx.serviceCaseAmountRevision.create({
      data: {
        serviceCaseId: data.serviceCaseId,
        previousAmountUsd: serviceCase.agreedAmountUsd,
        newAmountUsd: next,
        sourceCurrency: money.sourceCurrency,
        sourceAmount: money.sourceAmount,
        exchangeRateArsPerUsd: money.exchangeRateArsPerUsd,
        reason: data.reason,
        createdById: actor.id,
      },
    });
    return { changed: true };
  });
}

export async function setDirectCost(input: unknown) {
  const data = directCostSchema.parse(input);
  if (!data.amount.trim()) {
    await prisma.serviceCase.update({
      where: { id: data.serviceCaseId },
      data: {
        directCostUsd: null,
        directCostSourceCurrency: null,
        directCostSourceAmount: null,
        directCostExchangeRateArsPerUsd: null,
      },
    });
    return;
  }
  const money = normalizeMoneyInput(data);
  await prisma.serviceCase.update({
    where: { id: data.serviceCaseId },
    data: {
      directCostUsd: money.amountUsd,
      directCostSourceCurrency: money.sourceCurrency,
      directCostSourceAmount: money.sourceAmount,
      directCostExchangeRateArsPerUsd: money.exchangeRateArsPerUsd,
    },
  });
}

export async function createFinancialCategory(input: unknown, actor: Actor) {
  const data = categoryInputSchema.parse(input);
  return prisma.financialCategory.create({
    data: { ...data, createdById: actor.id, updatedById: actor.id },
    select: { id: true },
  });
}

export async function setFinancialCategoryActive(
  categoryId: string,
  active: boolean,
  actor: Actor,
) {
  return prisma.financialCategory.update({
    where: { id: categoryId },
    data: { active, updatedById: actor.id },
  });
}

export async function listFinancialOptions() {
  const [categories, serviceCases] = await Promise.all([
    prisma.financialCategory.findMany({
      where: { active: true },
      select: { id: true, name: true, direction: true },
      orderBy: [{ direction: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.serviceCase.findMany({
      select: {
        id: true,
        agreedAmountUsd: true,
        client: { select: { displayName: true } },
        vehicle: { select: { brand: true, model: true, year: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return { categories, serviceCases };
}

export async function listFinancialCategories() {
  return prisma.financialCategory.findMany({
    select: {
      id: true,
      name: true,
      direction: true,
      active: true,
      _count: { select: { entries: true } },
    },
    orderBy: [{ direction: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCaseFinancialSummary(serviceCaseId: string) {
  const serviceCase = await prisma.serviceCase.findUnique({
    where: { id: serviceCaseId },
    select: {
      id: true,
      agreedAmountUsd: true,
      agreedSourceCurrency: true,
      agreedSourceAmount: true,
      agreedExchangeRateArsPerUsd: true,
      directCostUsd: true,
      directCostSourceCurrency: true,
      directCostSourceAmount: true,
      directCostExchangeRateArsPerUsd: true,
      clientId: true,
      vehicleId: true,
    },
  });
  if (!serviceCase) return null;
  const client = await prisma.client.findUnique({
    where: { id: serviceCase.clientId },
    select: { displayName: true },
  });
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: serviceCase.vehicleId },
    select: { brand: true, model: true, year: true },
  });
  const entries = await prisma.financialEntry.findMany({
    where: { serviceCaseId },
    select: {
      id: true,
      direction: true,
      type: true,
      amountUsd: true,
      sourceCurrency: true,
      sourceAmount: true,
      exchangeRateArsPerUsd: true,
      occurredAt: true,
      description: true,
      paymentMethod: true,
      reversalOfId: true,
      reversedBy: { select: { id: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
  const revisions = await prisma.serviceCaseAmountRevision.findMany({
    where: { serviceCaseId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      previousAmountUsd: true,
      newAmountUsd: true,
      reason: true,
      createdAt: true,
    },
  });
  return {
    ...serviceCase,
    client,
    vehicle,
    entries,
    revisions,
    ...caseBalance(serviceCase.agreedAmountUsd, entries),
  };
}

export async function listFinancialEntries(options: {
  month?: string;
  direction?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}) {
  const month = /^\d{4}-\d{2}$/.test(options.month ?? "")
    ? options.month!
    : getBusinessMonthKey(new Date());
  const range = businessMonthRange(month);
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const direction = ["INFLOW", "OUTFLOW"].includes(options.direction ?? "")
    ? (options.direction as FinancialDirection)
    : undefined;
  const allowedTypes: FinancialEntryType[] = [
    "CUSTOMER_PAYMENT",
    "CUSTOMER_REFUND",
    "PURCHASE",
    "MANUAL_INCOME",
    "MANUAL_EXPENSE",
    "SALARY_PAYMENT",
    "REVERSAL",
  ];
  const type = allowedTypes.includes(options.type as FinancialEntryType)
    ? (options.type as FinancialEntryType)
    : undefined;
  const where: Prisma.FinancialEntryWhereInput = {
    occurredAt: { gte: range.start, lt: range.end },
    direction,
    type,
  };
  const items = await prisma.financialEntry.findMany({
    where,
    select: {
      id: true,
      direction: true,
      type: true,
      amountUsd: true,
      sourceCurrency: true,
      sourceAmount: true,
      exchangeRateArsPerUsd: true,
      occurredAt: true,
      description: true,
      reversalOfId: true,
      reversedBy: { select: { id: true } },
      salaryMonth: { select: { salaryId: true, month: true } },
      category: { select: { name: true } },
      serviceCase: {
        select: {
          id: true,
          client: { select: { displayName: true } },
          vehicle: { select: { brand: true, model: true } },
        },
      },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const total = await prisma.financialEntry.count({ where });
  const inflows = await prisma.financialEntry.aggregate({
    where: { ...where, direction: "INFLOW" },
    _sum: { amountUsd: true },
  });
  const outflows = await prisma.financialEntry.aggregate({
    where: { ...where, direction: "OUTFLOW" },
    _sum: { amountUsd: true },
  });
  const inflowUsd = inflows._sum.amountUsd ?? new Prisma.Decimal(0);
  const outflowUsd = outflows._sum.amountUsd ?? new Prisma.Decimal(0);
  return {
    items,
    total,
    month,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    inflowUsd,
    outflowUsd,
    netUsd: netCash([
      { direction: "INFLOW", amountUsd: inflowUsd },
      { direction: "OUTFLOW", amountUsd: outflowUsd },
    ]),
  };
}
