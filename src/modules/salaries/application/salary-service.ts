import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { normalizeMoneyInput } from "@/modules/money/domain/money";
import {
  adjustSalarySchema,
  cancelSalaryMonthSchema,
  createSalarySchema,
  nextSalaryMonth,
  paySalarySchema,
  salaryMonthSchema,
  salaryMonthsBetween,
  stopSalarySchema,
} from "@/modules/salaries/domain/salary-schema";
import {
  businessLocalDateTimeToUtc,
  getBusinessMonthKey,
} from "@/shared/date-time/business-time";

type Tx = Prisma.TransactionClient;
type Actor = { id: string };

// Every operation on a salary uses the same lock, including generation and reversals.
export async function lockSalary(tx: Tx, salaryId: string) {
  await tx.$queryRaw`SELECT "id" FROM "salaries" WHERE "id" = ${salaryId}::uuid FOR UPDATE`;
  return tx.salary.findUniqueOrThrow({ where: { id: salaryId } });
}
function event(
  tx: Tx,
  salaryId: string,
  actor: Actor,
  action: string,
  detail: Prisma.InputJsonObject,
) {
  return tx.salaryEvent.create({
    data: { salaryId, createdById: actor.id, action, detail },
  });
}
function checkVersion(actual: number, expected: number) {
  if (actual !== expected) throw new Error("SALARY_CONFLICT");
}
function currentMonth(now: Date) {
  return getBusinessMonthKey(now);
}
function checkMonth(month: string, now: Date, allowNext = false) {
  const current = currentMonth(now);
  if (month > (allowNext ? nextSalaryMonth(current) : current))
    throw new Error("SALARY_FUTURE_MONTH");
}
function hash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
async function replay(
  tx: Tx,
  operation: string,
  key: string,
  requestHash: string,
) {
  const existing = await tx.idempotencyKey.findUnique({
    where: { operation_key: { operation, key } },
  });
  if (!existing) return null;
  if (existing.requestHash !== requestHash)
    throw new Error("IDEMPOTENCY_CONFLICT");
  if (!existing.resultReference) throw new Error("IDEMPOTENCY_INCOMPLETE");
  return { id: existing.resultReference, replayed: true };
}
async function remember(
  tx: Tx,
  operation: string,
  key: string,
  requestHash: string,
  id: string,
  actor: Actor,
) {
  await tx.idempotencyKey.create({
    data: {
      operation,
      key,
      requestHash,
      resultReference: id,
      actorId: actor.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
}
async function lockRequest(tx: Tx, operation: string, key: string) {
  // Serialize identical submissions even before a salary exists.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${operation}:${key}`}, 0))::text`;
}

async function generateLocked(
  tx: Tx,
  salary: Awaited<ReturnType<typeof lockSalary>>,
  through: string,
) {
  const end =
    salary.endMonth && salary.endMonth < through ? salary.endMonth : through;
  if (end < salary.startMonth) return;
  const [rates, existing] = await Promise.all([
    tx.salaryRate.findMany({
      where: { salaryId: salary.id },
      orderBy: { effectiveMonth: "desc" },
    }),
    tx.salaryMonth.findMany({
      where: { salaryId: salary.id },
      select: { month: true },
    }),
  ]);
  const present = new Set(existing.map((item) => item.month));
  const missing = salaryMonthsBetween(salary.startMonth, end).filter(
    (month) => !present.has(month),
  );
  if (!missing.length) return;
  await tx.salaryMonth.createMany({
    data: missing.map((month) => {
      const rate = rates.find((item) => item.effectiveMonth <= month);
      if (!rate) throw new Error("SALARY_RATE_MISSING");
      return { salaryId: salary.id, month, amountUsd: rate.amountUsd };
    }),
    skipDuplicates: true,
  });
}

export async function ensureSalaryMonths(now = new Date()) {
  const through = currentMonth(now);
  const salaries = await prisma.salary.findMany({
    where: { startMonth: { lte: through } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  // Small independent transactions keep locks bounded and recover safely after interruption.
  for (const salary of salaries)
    await prisma.$transaction(async (tx) => {
      await generateLocked(tx, await lockSalary(tx, salary.id), through);
    });
}

export async function createSalary(
  input: unknown,
  actor: Actor,
  now = new Date(),
) {
  const data = createSalarySchema.parse(input);
  checkMonth(data.month, now);
  const requestHash = hash({ ...data, actorId: actor.id });
  return prisma.$transaction(async (tx) => {
    await lockRequest(tx, "CREATE_SALARY", data.idempotencyKey);
    const previous = await replay(
      tx,
      "CREATE_SALARY",
      data.idempotencyKey,
      requestHash,
    );
    if (previous) return previous;
    const salary = await tx.salary.create({
      data: {
        name: data.name,
        startMonth: data.month,
        createdById: actor.id,
        rates: {
          create: { effectiveMonth: data.month, amountUsd: data.amount },
        },
      },
    });
    await generateLocked(tx, salary, currentMonth(now));
    await event(tx, salary.id, actor, "CREATED", {
      name: data.name,
      month: data.month,
      amountUsd: data.amount,
    });
    await remember(
      tx,
      "CREATE_SALARY",
      data.idempotencyKey,
      requestHash,
      salary.id,
      actor,
    );
    return { id: salary.id, replayed: false };
  });
}

export async function adjustSalary(
  input: unknown,
  actor: Actor,
  now = new Date(),
) {
  const data = adjustSalarySchema.parse(input);
  checkMonth(data.month, now, data.scope === "RECURRING");
  return prisma.$transaction(async (tx) => {
    const salary = await lockSalary(tx, data.salaryId);
    checkVersion(salary.version, data.version);
    if (
      data.month < salary.startMonth ||
      (salary.endMonth && data.month > salary.endMonth)
    )
      throw new Error("SALARY_INACTIVE");
    await generateLocked(tx, salary, currentMonth(now));
    const month = await tx.salaryMonth.findUnique({
      where: { salaryId_month: { salaryId: salary.id, month: data.month } },
    });
    if (month && month.status !== "PENDING")
      throw new Error("SALARY_NOT_PENDING");
    if (data.scope === "RECURRING") {
      // The new base replaces any later scheduled base; snapshots before this month survive.
      await tx.salaryRate.deleteMany({
        where: { salaryId: salary.id, effectiveMonth: { gte: data.month } },
      });
      await tx.salaryRate.create({
        data: {
          salaryId: salary.id,
          effectiveMonth: data.month,
          amountUsd: data.amount,
        },
      });
      await tx.salaryMonth.updateMany({
        where: {
          salaryId: salary.id,
          month: { gte: data.month },
          status: "PENDING",
        },
        data: { amountUsd: data.amount, version: { increment: 1 } },
      });
    } else {
      if (!month) throw new Error("SALARY_MONTH_NOT_FOUND");
      await tx.salaryMonth.update({
        where: { id: month.id },
        data: { amountUsd: data.amount, version: { increment: 1 } },
      });
    }
    await tx.salary.update({
      where: { id: salary.id },
      data: { version: { increment: 1 } },
    });
    await event(tx, salary.id, actor, "ADJUSTED", {
      month: data.month,
      scope: data.scope,
      previousAmountUsd: month?.amountUsd.toFixed(2) ?? null,
      amountUsd: data.amount,
    });
  });
}

export async function stopSalary(
  input: unknown,
  actor: Actor,
  now = new Date(),
) {
  const data = stopSalarySchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const salary = await lockSalary(tx, data.salaryId);
    checkVersion(salary.version, data.version);
    // Ending recurrence never removes an already accrued obligation.
    if (data.month < currentMonth(now) || data.month < salary.startMonth)
      throw new Error("SALARY_INVALID_END");
    if (salary.endMonth) throw new Error("SALARY_INACTIVE");
    await generateLocked(tx, salary, currentMonth(now));
    await tx.salary.update({
      where: { id: salary.id },
      data: { endMonth: data.month, version: { increment: 1 } },
    });
    await event(tx, salary.id, actor, "STOPPED", { lastMonth: data.month });
  });
}

export async function cancelSalaryMonth(
  input: unknown,
  actor: Actor,
  now = new Date(),
) {
  const data = cancelSalaryMonthSchema.parse(input);
  checkMonth(data.month, now);
  return prisma.$transaction(async (tx) => {
    const salary = await lockSalary(tx, data.salaryId);
    checkVersion(salary.version, data.version);
    const month = await tx.salaryMonth.findUniqueOrThrow({
      where: { salaryId_month: { salaryId: salary.id, month: data.month } },
    });
    if (month.status !== "PENDING") throw new Error("SALARY_NOT_PENDING");
    await tx.salaryMonth.update({
      where: { id: month.id },
      data: { status: "CANCELLED", version: { increment: 1 } },
    });
    await tx.salary.update({
      where: { id: salary.id },
      data: { version: { increment: 1 } },
    });
    await event(tx, salary.id, actor, "CANCELLED", {
      month: data.month,
      reason: data.reason,
      amountUsd: month.amountUsd.toFixed(2),
    });
  });
}

export async function paySalary(
  input: unknown,
  actor: Actor,
  now = new Date(),
) {
  const data = paySalarySchema.parse(input);
  checkMonth(data.month, now);
  const occurredAt = businessLocalDateTimeToUtc(data.occurredLocal);
  if (occurredAt > now) throw new Error("SALARY_FUTURE_PAYMENT");
  const requestHash = hash({ ...data, actorId: actor.id });
  return prisma.$transaction(async (tx) => {
    await lockRequest(tx, "PAY_SALARY", data.idempotencyKey);
    const previous = await replay(
      tx,
      "PAY_SALARY",
      data.idempotencyKey,
      requestHash,
    );
    if (previous) return previous;
    const salary = await lockSalary(tx, data.salaryId);
    checkVersion(salary.version, data.version);
    await generateLocked(tx, salary, currentMonth(now));
    const month = await tx.salaryMonth.findUniqueOrThrow({
      where: { salaryId_month: { salaryId: salary.id, month: data.month } },
    });
    if (month.status !== "PENDING") throw new Error("SALARY_NOT_PENDING");
    const money = normalizeMoneyInput({
      currency: "USD",
      amount: month.amountUsd.toFixed(2),
    });
    const entry = await tx.financialEntry.create({
      data: {
        direction: "OUTFLOW",
        type: "SALARY_PAYMENT",
        ...money,
        occurredAt,
        salaryMonthId: month.id,
        description: `Sueldo de ${salary.name} · ${month.month}`,
        paymentMethod: data.paymentMethod,
        createdById: actor.id,
      },
    });
    await tx.salaryMonth.update({
      where: { id: month.id },
      data: {
        status: "PAID",
        paymentEntryId: entry.id,
        version: { increment: 1 },
      },
    });
    await tx.salary.update({
      where: { id: salary.id },
      data: { version: { increment: 1 } },
    });
    await event(tx, salary.id, actor, "PAID", {
      month: month.month,
      entryId: entry.id,
      amountUsd: money.amountUsd.toFixed(2),
    });
    await remember(
      tx,
      "PAY_SALARY",
      data.idempotencyKey,
      requestHash,
      entry.id,
      actor,
    );
    return { id: entry.id, replayed: false };
  });
}

// Called inside the finance reversal transaction with the salary row already locked.
export async function reopenSalaryPayment(
  tx: Tx,
  entryId: string,
  salaryMonthId: string,
  actor: Actor,
  reason: string,
) {
  const month = await tx.salaryMonth.findUniqueOrThrow({
    where: { id: salaryMonthId },
  });
  if (month.paymentEntryId !== entryId || month.status !== "PAID")
    throw new Error("SALARY_CONFLICT");
  await tx.salaryMonth.update({
    where: { id: month.id },
    data: {
      status: "PENDING",
      paymentEntryId: null,
      version: { increment: 1 },
    },
  });
  await tx.salary.update({
    where: { id: month.salaryId },
    data: { version: { increment: 1 } },
  });
  await event(tx, month.salaryId, actor, "PAYMENT_REVERSED", {
    month: month.month,
    entryId,
    reason,
  });
}

export async function getSalarySummary(now = new Date()) {
  await ensureSalaryMonths(now);
  const month = currentMonth(now);
  const [pending, previous] = await Promise.all([
    prisma.salaryMonth.aggregate({
      where: { status: "PENDING", month: { lte: month } },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.salaryMonth.aggregate({
      where: { status: "PENDING", month: { lt: month } },
      _sum: { amountUsd: true },
      _count: true,
    }),
  ]);
  return {
    pendingUsd: pending._sum.amountUsd ?? new Prisma.Decimal(0),
    pendingCount: pending._count,
    previousUsd: previous._sum.amountUsd ?? new Prisma.Decimal(0),
    previousCount: previous._count,
  };
}

export async function listSalaries(
  options: { month?: string; pending?: boolean } = {},
  now = new Date(),
) {
  const parsed = salaryMonthSchema.safeParse(options.month);
  const month =
    parsed.success && parsed.data <= currentMonth(now)
      ? parsed.data
      : currentMonth(now);
  await ensureSalaryMonths(now);
  const [items, first, previous, totals] = await Promise.all([
    prisma.salaryMonth.findMany({
      where: options.pending
        ? { status: "PENDING", month: { lte: month } }
        : { month },
      include: {
        salary: {
          include: { rates: { orderBy: { effectiveMonth: "desc" }, take: 1 } },
        },
        payment: true,
      },
      orderBy: [{ month: "asc" }, { salary: { name: "asc" } }],
    }),
    prisma.salary.findFirst({
      orderBy: { startMonth: "asc" },
      select: { startMonth: true },
    }),
    prisma.salaryMonth.aggregate({
      where: { status: "PENDING", month: { lt: month } },
      _sum: { amountUsd: true },
      _count: true,
    }),
    prisma.salaryMonth.groupBy({
      by: ["status"],
      where: { month },
      _sum: { amountUsd: true },
    }),
  ]);
  const pendingUsd =
    totals.find((item) => item.status === "PENDING")?._sum.amountUsd ??
    new Prisma.Decimal(0);
  const paidUsd =
    totals.find((item) => item.status === "PAID")?._sum.amountUsd ??
    new Prisma.Decimal(0);
  return {
    items,
    month,
    minMonth: first?.startMonth ?? month,
    currentMonth: currentMonth(now),
    pendingUsd,
    paidUsd,
    totalUsd: pendingUsd.plus(paidUsd),
    previousUsd: previous._sum.amountUsd ?? new Prisma.Decimal(0),
    previousCount: previous._count,
  };
}

export async function getSalaryDetail(id: string, now = new Date()) {
  if (!z.string().uuid().safeParse(id).success) return null;
  await ensureSalaryMonths(now);
  return prisma.salary.findUnique({
    where: { id },
    include: {
      rates: { orderBy: { effectiveMonth: "desc" } },
      months: { orderBy: { month: "desc" }, include: { payment: true } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
}
