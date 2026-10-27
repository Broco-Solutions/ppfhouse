import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db/client";
import { getAdminDashboard } from "@/modules/dashboard/application/dashboard-service";
import {
  listFinancialEntries,
  reverseFinancialEntry,
} from "@/modules/finance/application/finance-service";
import {
  adjustSalary,
  cancelSalaryMonth,
  createSalary,
  ensureSalaryMonths,
  getSalaryDetail,
  getSalarySummary,
  listSalaries,
  paySalary,
  stopSalary,
} from "@/modules/salaries/application/salary-service";

const now = new Date("2026-10-20T15:00:00Z");
const salaryIds: string[] = [];
let actor = { id: "" };
async function create(month = "2026-10", amount = "1000") {
  const result = await createSalary(
    {
      name: `Persona ${randomUUID().slice(0, 8)}`,
      month,
      amount,
      idempotencyKey: randomUUID(),
    },
    actor,
    now,
  );
  salaryIds.push(result.id);
  return result.id;
}
async function detail(id: string) {
  return (await getSalaryDetail(id, now))!;
}
async function paymentInput(id: string, month = "2026-10") {
  return {
    salaryId: id,
    month,
    version: (await detail(id)).version,
    occurredLocal: "2026-10-19T12:00",
    paymentMethod: "TRANSFER",
    idempotencyKey: randomUUID(),
  };
}

describe("recurring salaries and cash ledger", () => {
  beforeAll(async () => {
    actor = {
      id: (
        await prisma.user.create({
          data: {
            name: "Salary test admin",
            email: `salary-${randomUUID()}@ferraro.test`,
            role: "ADMIN",
          },
        })
      ).id,
    };
  });
  afterAll(async () => {
    await prisma.salaryMonth.updateMany({
      where: { salaryId: { in: salaryIds } },
      data: { status: "PENDING", paymentEntryId: null },
    });
    const entries = await prisma.financialEntry.findMany({
      where: { salaryMonth: { salaryId: { in: salaryIds } } },
      select: { id: true },
    });
    await prisma.idempotencyKey.deleteMany({ where: { actorId: actor.id } });
    await prisma.financialEntry.deleteMany({
      where: { id: { in: entries.map((item) => item.id) }, type: "REVERSAL" },
    });
    await prisma.financialEntry.deleteMany({
      where: { id: { in: entries.map((item) => item.id) } },
    });
    await prisma.salaryEvent.deleteMany({
      where: { salaryId: { in: salaryIds } },
    });
    await prisma.salaryRate.deleteMany({
      where: { salaryId: { in: salaryIds } },
    });
    await prisma.salaryMonth.deleteMany({
      where: { salaryId: { in: salaryIds } },
    });
    await prisma.salary.deleteMany({ where: { id: { in: salaryIds } } });
    if (actor.id) await prisma.user.delete({ where: { id: actor.id } });
  });

  it("creates once under concurrent submissions and catches up missed months", async () => {
    const input = {
      name: "Persona sin usuario",
      month: "2026-08",
      amount: "950,50",
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all([
      createSalary(input, actor, now),
      createSalary(input, actor, now),
    ]);
    expect(results[0].id).toBe(results[1].id);
    salaryIds.push(results[0].id);
    const initial = await detail(results[0].id);
    expect(initial.months.map((item) => item.month)).toEqual([
      "2026-10",
      "2026-09",
      "2026-08",
    ]);
    expect(
      initial.months.every(
        (item) => item.status === "PENDING" && item.amountUsd.equals("950.50"),
      ),
    ).toBe(true);
    await Promise.all([
      ensureSalaryMonths(new Date("2027-01-02T12:00:00Z")),
      ensureSalaryMonths(new Date("2027-01-02T12:00:00Z")),
    ]);
    expect(
      await prisma.salaryMonth.count({ where: { salaryId: initial.id } }),
    ).toBe(6);
    await expect(
      createSalary({ ...input, amount: "1" }, actor, now),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("preserves past months, supports one-month exceptions and scheduled increases", async () => {
    const id = await create("2026-08");
    await paySalary(await paymentInput(id, "2026-08"), actor, now);
    let salary = await detail(id);
    await adjustSalary(
      {
        salaryId: id,
        month: "2026-09",
        amount: "1100",
        scope: "MONTH",
        version: salary.version,
      },
      actor,
      now,
    );
    salary = await detail(id);
    expect(
      salary.months
        .find((item) => item.month === "2026-09")!
        .amountUsd.toString(),
    ).toBe("1100");
    expect(
      salary.months
        .find((item) => item.month === "2026-10")!
        .amountUsd.toString(),
    ).toBe("1000");
    await adjustSalary(
      {
        salaryId: id,
        month: "2026-10",
        amount: "1200",
        scope: "RECURRING",
        version: salary.version,
      },
      actor,
      now,
    );
    salary = await detail(id);
    await adjustSalary(
      {
        salaryId: id,
        month: "2026-11",
        amount: "1300",
        scope: "RECURRING",
        version: salary.version,
      },
      actor,
      now,
    );
    await ensureSalaryMonths(new Date("2026-11-02T12:00:00Z"));
    salary = await detail(id);
    expect(
      salary.months
        .find((item) => item.month === "2026-08")!
        .amountUsd.toString(),
    ).toBe("1000");
    expect(
      salary.months
        .find((item) => item.month === "2026-10")!
        .amountUsd.toString(),
    ).toBe("1200");
    expect(
      salary.months
        .find((item) => item.month === "2026-11")!
        .amountUsd.toString(),
    ).toBe("1300");
    await expect(
      adjustSalary(
        {
          salaryId: id,
          month: "2026-08",
          amount: "1",
          scope: "MONTH",
          version: salary.version,
        },
        actor,
        now,
      ),
    ).rejects.toThrow("SALARY_NOT_PENDING");
  });

  it("prevents duplicate payments, detects stale edits, and makes generic reversals reopen debt", async () => {
    const id = await create();
    const input = await paymentInput(id);
    const paid = await Promise.all([
      paySalary(input, actor, now),
      paySalary(input, actor, now),
    ]);
    expect(paid[0].id).toBe(paid[1].id);
    const salary = await detail(id);
    expect(salary.months[0]!.status).toBe("PAID");
    const entry = await prisma.financialEntry.findUniqueOrThrow({
      where: { id: paid[0].id },
    });
    expect(entry.amountUsd.toString()).toBe("1000");
    expect(entry.sourceAmount.toString()).toBe("1000");
    expect(entry.sourceCurrency).toBe("USD");
    expect(entry.exchangeRateArsPerUsd).toBeNull();
    await expect(
      adjustSalary(
        {
          salaryId: id,
          month: "2026-10",
          amount: "2000",
          scope: "MONTH",
          version: input.version,
        },
        actor,
        now,
      ),
    ).rejects.toThrow("SALARY_CONFLICT");
    await expect(
      paySalary(
        { ...input, version: salary.version, idempotencyKey: randomUUID() },
        actor,
        now,
      ),
    ).rejects.toThrow("SALARY_NOT_PENDING");
    const reversed = await Promise.all([
      reverseFinancialEntry(
        { entryId: entry.id, reason: "Importe incorrecto" },
        actor,
      ),
      reverseFinancialEntry(
        { entryId: entry.id, reason: "Importe incorrecto" },
        actor,
      ),
    ]);
    expect(reversed[0].id).toBe(reversed[1].id);
    expect((await detail(id)).months[0]!.status).toBe("PENDING");
    // A replay after reversal cannot accidentally pay the debt again.
    expect((await paySalary(input, actor, now)).id).toBe(entry.id);
    expect((await detail(id)).months[0]!.status).toBe("PENDING");
    const newInput = await paymentInput(id);
    await paySalary(newInput, actor, now);
    const repaid = await detail(id);
    expect(repaid.months[0]!.status).toBe("PAID");
    expect(repaid.events.filter((item) => item.action === "PAID")).toHaveLength(
      2,
    );
    expect(
      repaid.events.filter((item) => item.action === "PAYMENT_REVERSED"),
    ).toHaveLength(1);
    await reverseFinancialEntry(
      { entryId: entry.id, reason: "Reintento antiguo" },
      actor,
    );
    expect((await detail(id)).months[0]!.status).toBe("PAID");
  });

  it("serializes conflicting payments submitted with different request keys", async () => {
    const id = await create();
    const input = await paymentInput(id);
    const results = await Promise.allSettled([
      paySalary(input, actor, now),
      paySalary({ ...input, idempotencyKey: randomUUID() }, actor, now),
    ]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );
    expect(
      await prisma.financialEntry.count({
        where: { salaryMonth: { salaryId: id }, type: "SALARY_PAYMENT" },
      }),
    ).toBe(1);
  });

  it("keeps cash in the payment month and pending obligations in USD", async () => {
    const november = new Date("2026-11-10T15:00:00Z");
    const id = await create();
    const before = await getAdminDashboard(november);
    const input = await paymentInput(id);
    await paySalary(
      { ...input, occurredLocal: "2026-11-05T12:00" },
      actor,
      november,
    );
    const after = await getAdminDashboard(november);
    expect(after.outflowUsd.minus(before.outflowUsd).toString()).toBe("1000");
    expect(after.cashNetUsd.minus(before.cashNetUsd).toString()).toBe("-1000");
    expect(after.knownMarginUsd.toString()).toBe(
      before.knownMarginUsd.toString(),
    );
    expect(
      after.salaries.pendingUsd.minus(before.salaries.pendingUsd).toString(),
    ).toBe("-1000");
    const ledger = await listFinancialEntries({
      month: "2026-11",
      type: "SALARY_PAYMENT",
    });
    expect(
      ledger.items.some(
        (item) =>
          item.salaryMonth?.salaryId === id &&
          item.salaryMonth.month === "2026-10",
      ),
    ).toBe(true);
    const list = await listSalaries({ month: "2026-10" }, now);
    expect(list.items.find((item) => item.salaryId === id)?.status).toBe(
      "PAID",
    );
    expect((await getSalarySummary(november)).pendingUsd.gte(0)).toBe(true);
  });

  it("ends recurrence without removing debts, and excludes annulled monthly records", async () => {
    const id = await create("2026-09");
    let salary = await detail(id);
    await cancelSalaryMonth(
      {
        salaryId: id,
        month: "2026-09",
        reason: "Carga anterior al ingreso",
        version: salary.version,
      },
      actor,
      now,
    );
    salary = await detail(id);
    await stopSalary(
      { salaryId: id, month: "2026-10", version: salary.version },
      actor,
      now,
    );
    await ensureSalaryMonths(new Date("2027-01-02T12:00:00Z"));
    salary = await detail(id);
    expect(salary.months).toHaveLength(2);
    expect(salary.months.find((item) => item.month === "2026-10")?.status).toBe(
      "PENDING",
    );
    expect(salary.months.find((item) => item.month === "2026-09")?.status).toBe(
      "CANCELLED",
    );
    await expect(
      paySalary(await paymentInput(id, "2026-09"), actor, now),
    ).rejects.toThrow("SALARY_NOT_PENDING");
    const pending = await listSalaries(
      { month: "2026-10", pending: true },
      now,
    );
    expect(
      pending.items
        .filter((item) => item.salaryId === id)
        .map((item) => item.month),
    ).toEqual(["2026-10"]);
  });

  it("rejects ARS payroll entries at the database boundary", async () => {
    const id = await create();
    const salary = await detail(id);
    await expect(
      prisma.financialEntry.create({
        data: {
          direction: "OUTFLOW",
          type: "SALARY_PAYMENT",
          salaryMonthId: salary.months[0]!.id,
          sourceCurrency: "ARS",
          sourceAmount: "1000000",
          amountUsd: "1000",
          exchangeRateArsPerUsd: "1000",
          occurredAt: now,
          createdById: actor.id,
        },
      }),
    ).rejects.toThrow();
    expect((await detail(id)).months[0]!.status).toBe("PENDING");
  });

  it("refuses to relabel existing salary records during the currency migration", async () => {
    const id = await create();
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    try {
      const migration = await readFile(
        new URL(
          "../../prisma/migrations/20261021000000_salary_usd/migration.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await expect(client.query(migration)).rejects.toThrow(
        "SALARY_CURRENCY_REVIEW_REQUIRED",
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
    expect((await detail(id)).months[0]!.amountUsd.toString()).toBe("1000");
  });

  it("uses the business timezone and rejects future or invalid payments", async () => {
    const boundary = new Date("2026-11-01T02:00:00Z"); // still October in Buenos Aires
    const id = await create();
    await ensureSalaryMonths(boundary);
    expect(
      (await prisma.salaryMonth.findMany({ where: { salaryId: id } })).map(
        (item) => item.month,
      ),
    ).toEqual(["2026-10"]);
    const input = await paymentInput(id);
    await expect(
      paySalary({ ...input, occurredLocal: "2026-10-21T12:00" }, actor, now),
    ).rejects.toThrow("SALARY_FUTURE_PAYMENT");
    await expect(
      paySalary({ ...input, paymentMethod: "INVALID" }, actor, now),
    ).rejects.toThrow();
    await expect(
      createSalary(
        {
          name: "Persona futura",
          amount: "100",
          month: "2026-11",
          idempotencyKey: randomUUID(),
        },
        actor,
        now,
      ),
    ).rejects.toThrow("SALARY_FUTURE_MONTH");
    expect(await getSalaryDetail("not-a-uuid", now)).toBeNull();
  });
});
