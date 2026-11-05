import { beforeEach, afterEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  groupBy: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@/infrastructure/db/client", () => ({
  prisma: {
    financialEntry: db,
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({ financialEntry: db }),
  },
}));
import { Prisma } from "@/generated/prisma/client";
import { getConsolidatedExpenses } from "@/modules/finance/application/egresos";
import { periodRange } from "@/modules/finance/application/consolidado";
import { GET } from "@/app/api/consolidado/egresos/route";
const params = new URLSearchParams({
  periodo: "rango",
  desde: "2026-11-01",
  hasta: "2026-11-30",
});
const range = periodRange(params);
const entry = (
  id: string,
  type: string,
  amount: string,
  date = "2026-11-10T03:00:00Z",
  original?: string,
) => ({
  id,
  type,
  direction: original || type === "MANUAL_INCOME" ? "INFLOW" : "OUTFLOW",
  amountUsd: new Prisma.Decimal(amount),
  occurredAt: new Date(date),
  reversalOf: original ? { type: original } : null,
});
type Entry = ReturnType<typeof entry>;
let rows: Entry[];
function matches(row: Entry, where: Prisma.FinancialEntryWhereInput): boolean {
  const bounds = where.occurredAt as { gte: Date; lt: Date };
  const branches = where.OR!;
  return (
    row.occurredAt >= bounds.gte &&
    row.occurredAt < bounds.lt &&
    branches.some((branch) => {
      const types =
        typeof branch.type === "string"
          ? [branch.type]
          : (branch.type as { in: string[] }).in;
      if (!types.includes(row.type)) return false;
      if (!branch.reversalOf) return true;
      const original = (
        branch.reversalOf as { is: { type: string | { in: string[] } } }
      ).is.type;
      return (
        !!row.reversalOf &&
        (typeof original === "string"
          ? row.reversalOf.type === original
          : original.in.includes(row.reversalOf.type))
      );
    })
  );
}
beforeEach(() => {
  rows = [];
  vi.stubEnv("CONSOLIDADO_API_KEY", "a".repeat(32));
  db.groupBy.mockImplementation(async ({ where }) =>
    ["OUTFLOW", "INFLOW"].map((direction) => ({
      direction,
      _sum: {
        amountUsd: rows
          .filter((row) => matches(row, where) && row.direction === direction)
          .reduce((sum, row) => sum.plus(row.amountUsd), new Prisma.Decimal(0)),
      },
    })),
  );
  db.count.mockImplementation(
    async ({ where }) => rows.filter((row) => matches(row, where)).length,
  );
  db.findMany.mockImplementation(async ({ where, skip, take }) =>
    rows
      .filter((row) => matches(row, where))
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .slice(skip, skip + take),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it.each([
  ["PURCHASE", "100.00", "compras"],
  ["MANUAL_EXPENSE", "30.00", "gastosManuales"],
  ["SALARY_PAYMENT", "500.00", "sueldosPagados"],
] as const)("counts %s once", async (type, amount, key) => {
  rows = [entry("1", type, amount)];
  expect((await getConsolidatedExpenses(range)).totales[key]).toBe(amount);
});
it("combines purchases, manual expenses and paid salaries without personal fields", async () => {
  rows = [
    entry("1", "PURCHASE", "100"),
    entry("2", "MANUAL_EXPENSE", "30"),
    entry("3", "SALARY_PAYMENT", "500"),
  ];
  const data = await getConsolidatedExpenses(range);
  expect(data.totales.egresos).toBe("630.00");
  expect(Object.keys(data.movimientos[0]!).sort()).toEqual([
    "fecha",
    "id",
    "importeUsd",
    "reversion",
    "tipo",
  ]);
  expect(db.findMany.mock.calls[0]![0]).toMatchObject({
    skip: 0,
    take: 25,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
  expect(JSON.stringify(db.findMany.mock.calls)).not.toMatch(
    /salaryMonth|description|name|client/,
  );
});
it("pending salary without a payment entry and empty periods are exact zero", async () => {
  expect((await getConsolidatedExpenses(range)).totales).toEqual({
    compras: "0.00",
    gastosManuales: "0.00",
    sueldosPagados: "0.00",
    egresos: "0.00",
  });
});
it("applies salary reversal in its effective period, leaving the older payment intact", async () => {
  rows = [
    entry("1", "SALARY_PAYMENT", "500", "2026-10-31T23:00:00Z"),
    entry("2", "REVERSAL", "500", "2026-11-01T03:00:00Z", "SALARY_PAYMENT"),
  ];
  const result = await getConsolidatedExpenses(range);
  expect(result.totales.sueldosPagados).toBe("-500.00");
  const october = periodRange(
    new URLSearchParams({
      periodo: "rango",
      desde: "2026-10-01",
      hasta: "2026-10-31",
    }),
  );
  expect((await getConsolidatedExpenses(october)).totales.sueldosPagados).toBe(
    "500.00",
  );
  expect(result.movimientos[0]).toMatchObject({
    tipo: "SALARY_PAYMENT",
    reversion: true,
    importeUsd: "-500.00",
  });
});
it.each(["CUSTOMER_PAYMENT", "CUSTOMER_REFUND", "MANUAL_INCOME"])(
  "excludes %s and its reversal",
  async (type) => {
    rows = [
      entry("1", type, "100"),
      entry("2", "REVERSAL", "100", undefined, type),
    ];
    const data = await getConsolidatedExpenses(range);
    expect(data.totales.egresos).toBe("0.00");
    expect(data.movimientos).toEqual([]);
  },
);
it("uses exact cents and all three reversal categories", async () => {
  rows = [
    entry("1", "PURCHASE", "0.10"),
    entry("2", "MANUAL_EXPENSE", "0.20"),
    entry("3", "SALARY_PAYMENT", "0.30"),
    entry("4", "REVERSAL", "0.10", undefined, "PURCHASE"),
    entry("5", "REVERSAL", "0.20", undefined, "MANUAL_EXPENSE"),
  ];
  expect((await getConsolidatedExpenses(range)).totales).toEqual({
    compras: "0.00",
    gastosManuales: "0.00",
    sueldosPagados: "0.30",
    egresos: "0.30",
  });
});
it("includes Argentine month edges once and excludes adjacent months", async () => {
  rows = [
    entry("1", "PURCHASE", "1", "2026-11-01T02:59:59.999Z"),
    entry("2", "PURCHASE", "2", "2026-11-01T03:00:00.000Z"),
    entry("3", "PURCHASE", "3", "2026-12-01T02:59:59.999Z"),
    entry("4", "PURCHASE", "4", "2026-12-01T03:00:00.000Z"),
  ];
  const data = await getConsolidatedExpenses(range);
  expect(data.totales.compras).toBe("5.00");
  const october = periodRange(
    new URLSearchParams({
      periodo: "rango",
      desde: "2026-10-01",
      hasta: "2026-10-31",
    }),
  );
  const december = periodRange(
    new URLSearchParams({
      periodo: "rango",
      desde: "2026-12-01",
      hasta: "2026-12-31",
    }),
  );
  expect((await getConsolidatedExpenses(october)).totales.compras).toBe("1.00");
  expect((await getConsolidatedExpenses(december)).totales.compras).toBe(
    "4.00",
  );
  expect(data.periodo).toEqual({
    desde: "2026-11-01T03:00:00.000Z",
    hasta: "2026-12-01T02:59:59.999Z",
  });
});
it("page two differs and keeps period totals", async () => {
  rows = Array.from({ length: 30 }, (_, i) =>
    entry(String(i).padStart(2, "0"), "PURCHASE", "1"),
  );
  const first = await getConsolidatedExpenses(range, 1),
    second = await getConsolidatedExpenses(range, 2);
  expect(first.movimientos).toHaveLength(25);
  expect(second.movimientos).toHaveLength(5);
  expect(
    second.movimientos.some((row) =>
      first.movimientos.some((other) => other.id === row.id),
    ),
  ).toBe(false);
  expect(second.totales).toEqual(first.totales);
  expect(second.totales.egresos).toBe("30.00");
  expect(second.paginacion).toEqual({
    pagina: 2,
    porPagina: 25,
    total: 30,
    totalPaginas: 2,
    hayMas: false,
  });
});
const request = (
  query = params.toString(),
  key: string | null = "a".repeat(32),
) =>
  new Request("https://local.test?" + query, {
    headers: key ? { "x-api-key": key } : {},
  });
it.each([null, "b".repeat(32)])(
  "rejects absent or wrong authentication before queries",
  async (key) => {
    expect((await GET(request(undefined, key))).status).toBe(401);
    expect(db.groupBy).not.toHaveBeenCalled();
    expect(db.findMany).not.toHaveBeenCalled();
  },
);
it.each([
  "&pagina=0",
  "&pagina=1.5",
  "&pagina=abc",
  "&pagina=1000001",
  "&pagina=1&pagina=2",
  "&hasta=2026-02-30",
])("rejects invalid date or page %s", async (suffix) => {
  expect((await GET(request(params + suffix))).status).toBe(400);
  expect(db.groupBy).not.toHaveBeenCalled();
});
it("rejects an impossible calendar date", async () => {
  expect(
    (await GET(request("periodo=rango&desde=2026-02-30&hasta=2026-03-31")))
      .status,
  ).toBe(400);
});
it("sanitizes database errors", async () => {
  db.groupBy.mockRejectedValue(new Error("private database error"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "UNAVAILABLE" });
});
it("serves the v1 contract without caching", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toMatchObject({
    version: 1,
    moneda: "USD",
    paginacion: { pagina: 1, total: 0, totalPaginas: 1 },
  });
});
