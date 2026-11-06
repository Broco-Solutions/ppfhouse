import { afterEach, beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/infrastructure/db/client", () => ({
  prisma: { financialEntry: db, $transaction: db.transaction },
}));
import { Prisma } from "@/generated/prisma/client";
import { getConsolidatedCollections } from "@/modules/finance/application/cobros";
import {
  periodRange,
  summary,
} from "@/modules/finance/application/consolidado";
import { GET } from "@/app/api/consolidado/cobros/route";

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
  direction:
    (original ?? type) === "CUSTOMER_PAYMENT"
      ? original
        ? "OUTFLOW"
        : "INFLOW"
      : original
        ? "INFLOW"
        : "OUTFLOW",
  amountUsd: new Prisma.Decimal(amount),
  occurredAt: new Date(date),
  reversalOf: original ? { type: original } : null,
  description: "private description",
  client: { name: "private name", email: "private@example.test" },
});
type Entry = ReturnType<typeof entry>;
let rows: Entry[];
function matches(row: Entry, where: Prisma.FinancialEntryWhereInput) {
  const bounds = where.occurredAt as { gte: Date; lt: Date };
  return (
    row.occurredAt >= bounds.gte &&
    row.occurredAt < bounds.lt &&
    where.OR!.some((branch) => {
      const types =
        typeof branch.type === "string"
          ? [branch.type]
          : (branch.type as { in: string[] }).in;
      if (!types.includes(row.type)) return false;
      if (!branch.reversalOf) return true;
      const original = (branch.reversalOf as { is: { type: { in: string[] } } })
        .is.type;
      return !!row.reversalOf && original.in.includes(row.reversalOf.type);
    })
  );
}
const request = (
  query = params.toString(),
  key: string | null = "a".repeat(32),
) =>
  new Request("https://local.test/api/consolidado/cobros?" + query, {
    headers: key === null ? {} : { "x-api-key": key },
  });

beforeEach(() => {
  rows = [];
  vi.stubEnv("CONSOLIDADO_API_KEY", "a".repeat(32));
  db.transaction.mockImplementation(async (fn) => fn({ financialEntry: db }));
  db.count.mockImplementation(
    async ({ where }) => rows.filter((row) => matches(row, where)).length,
  );
  db.findMany.mockImplementation(
    async ({ where, skip = 0, take = rows.length }) =>
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

it.each([null, "wrong", "b".repeat(32)])(
  "rejects invalid authentication %s before queries",
  async (key) => {
    const response = await GET(request(undefined, key));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.findMany).not.toHaveBeenCalled();
  },
);
it.each(["", "short"])(
  "fails closed with invalid configured key %s",
  async (key) => {
    vi.stubEnv("CONSOLIDADO_API_KEY", key);
    expect((await GET(request())).status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
  },
);
it("accepts the configured key and returns the exact private v1 contract", async () => {
  rows = [entry("1", "CUSTOMER_PAYMENT", "12.3")];
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
  expect(response.headers.get("location")).toBeNull();
  expect(await response.json()).toEqual({
    empresaId: "ppf-house",
    moneda: "USD",
    version: 1,
    periodo: {
      desde: "2026-11-01T03:00:00.000Z",
      hasta: "2026-12-01T02:59:59.999Z",
    },
    movimientos: [
      {
        id: "1",
        fecha: "2026-11-10T03:00:00.000Z",
        tipo: "CUSTOMER_PAYMENT",
        reversion: false,
        importeUsd: "12.30",
      },
    ],
    paginacion: {
      pagina: 1,
      porPagina: 25,
      total: 1,
      totalPaginas: 1,
      hayMas: false,
    },
  });
  expect(db.findMany.mock.calls[0]![0].select).toEqual({
    id: true,
    occurredAt: true,
    type: true,
    direction: true,
    amountUsd: true,
    reversalOf: { select: { type: true } },
  });
  expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
});
it("includes payments, deposits, partial payments, refunds and both reversal types with exact signs", async () => {
  rows = [
    entry("1", "CUSTOMER_PAYMENT", "100"),
    entry("2", "CUSTOMER_PAYMENT", "20.10"), // deposit
    entry("3", "CUSTOMER_PAYMENT", "0.20"), // partial payment
    entry("4", "CUSTOMER_REFUND", "10"),
    entry("5", "REVERSAL", "30", undefined, "CUSTOMER_PAYMENT"),
    entry("6", "REVERSAL", "5", undefined, "CUSTOMER_REFUND"),
  ];
  expect(
    (await getConsolidatedCollections(range)).movimientos.map(
      ({ tipo, reversion, importeUsd }) => ({ tipo, reversion, importeUsd }),
    ),
  ).toEqual([
    { tipo: "CUSTOMER_REFUND", reversion: true, importeUsd: "5.00" },
    { tipo: "CUSTOMER_PAYMENT", reversion: true, importeUsd: "-30.00" },
    { tipo: "CUSTOMER_REFUND", reversion: false, importeUsd: "-10.00" },
    { tipo: "CUSTOMER_PAYMENT", reversion: false, importeUsd: "0.20" },
    { tipo: "CUSTOMER_PAYMENT", reversion: false, importeUsd: "20.10" },
    { tipo: "CUSTOMER_PAYMENT", reversion: false, importeUsd: "100.00" },
  ]);
});
it.each(["PURCHASE", "SALARY_PAYMENT", "MANUAL_EXPENSE", "MANUAL_INCOME"])(
  "excludes %s and its reversal",
  async (type) => {
    rows = [
      entry("1", type, "100"),
      entry("2", "REVERSAL", "100", undefined, type),
      entry("3", "REVERSAL", "10"),
    ];
    expect((await getConsolidatedCollections(range)).movimientos).toEqual([]);
  },
);
it("uses exact Argentine edges and occurredAt rather than original payment date", async () => {
  rows = [
    entry("1", "CUSTOMER_PAYMENT", "1", "2026-11-01T02:59:59.999Z"),
    entry("2", "CUSTOMER_PAYMENT", "2", "2026-11-01T03:00:00.000Z"),
    entry("3", "CUSTOMER_PAYMENT", "3", "2026-12-01T02:59:59.999Z"),
    entry("4", "REVERSAL", "1", "2026-12-01T02:59:59.999Z", "CUSTOMER_PAYMENT"),
    entry("5", "REVERSAL", "2", "2026-12-01T03:00:00.000Z", "CUSTOMER_PAYMENT"),
  ];
  expect(
    (await getConsolidatedCollections(range)).movimientos.map((row) => row.id),
  ).toEqual(["4", "3", "2"]);
  const october = periodRange(
    new URLSearchParams({
      periodo: "rango",
      desde: "2026-10-31",
      hasta: "2026-10-31",
    }),
  );
  expect(
    (await getConsolidatedCollections(october)).movimientos.map(
      (row) => row.id,
    ),
  ).toEqual(["1"]);
  const december = periodRange(
    new URLSearchParams({
      periodo: "rango",
      desde: "2026-12-01",
      hasta: "2026-12-01",
    }),
  );
  expect(
    (await getConsolidatedCollections(december)).movimientos[0],
  ).toMatchObject({ id: "5", importeUsd: "-2.00" });
});
it("paginates by date then descending ID, with 25 rows and no overlap", async () => {
  rows = Array.from({ length: 51 }, (_, i) =>
    entry(String(i).padStart(2, "0"), "CUSTOMER_PAYMENT", "1"),
  );
  rows.push(entry("older", "CUSTOMER_PAYMENT", "1", "2026-11-09T03:00:00Z"));
  const pages = await Promise.all(
    [1, 2, 3].map((page) => getConsolidatedCollections(range, page)),
  );
  expect(pages.map((page) => page.movimientos.length)).toEqual([25, 25, 2]);
  expect(
    pages.flatMap((page) => page.movimientos.map((row) => row.id)),
  ).toEqual([
    ...Array.from({ length: 51 }, (_, i) => String(50 - i).padStart(2, "0")),
    "older",
  ]);
  expect(pages[0]!.paginacion).toEqual({
    pagina: 1,
    porPagina: 25,
    total: 52,
    totalPaginas: 3,
    hayMas: true,
  });
  expect(pages[2]!.paginacion.hayMas).toBe(false);
  expect(db.findMany.mock.calls[1]![0]).toMatchObject({
    skip: 25,
    take: 25,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
  expect((await getConsolidatedCollections(range, 4)).movimientos).toEqual([]);
});
it("returns an empty period with the same pagination convention as expenses", async () => {
  const data = await getConsolidatedCollections(range);
  expect(data.movimientos).toEqual([]);
  expect(data.paginacion).toEqual({
    pagina: 1,
    porPagina: 25,
    total: 0,
    totalPaginas: 1,
    hayMas: false,
  });
});
it("reconciles every page exactly with summary and keeps the same selection", async () => {
  rows = Array.from({ length: 53 }, (_, i) =>
    entry(String(i).padStart(2, "0"), "CUSTOMER_PAYMENT", "0.10"),
  );
  rows.push(
    entry("refund", "CUSTOMER_REFUND", "0.20"),
    entry("rev-payment", "REVERSAL", "0.10", undefined, "CUSTOMER_PAYMENT"),
    entry("rev-refund", "REVERSAL", "0.20", undefined, "CUSTOMER_REFUND"),
    entry("excluded", "MANUAL_INCOME", "999"),
  );
  const movements = [];
  for (let page = 1; ; page++) {
    const data = await getConsolidatedCollections(range, page);
    movements.push(...data.movimientos);
    if (!data.paginacion.hayMas) break;
  }
  const collectionWhere = db.findMany.mock.calls[0]![0].where;
  const result = await summary(range);
  expect(db.findMany.mock.lastCall![0].where).toEqual(collectionWhere);
  expect(
    movements
      .reduce((sum, row) => sum.plus(row.importeUsd), new Prisma.Decimal(0))
      .toFixed(2),
  ).toBe(result.cobros);
  expect(result.cobros).toBe("5.20");
  expect(movements).toHaveLength(result.movimientos);
  expect(JSON.stringify(movements)).not.toMatch(
    /private|description|client|email/,
  );
});
it.each([
  "pagina=0",
  "pagina=-1",
  "pagina=1.5",
  "pagina=abc",
  "pagina=",
  "pagina=01",
  "pagina=1e2",
  "pagina=+1",
  "pagina=1000001",
  "pagina=9007199254740992",
  "pagina=1&pagina=2",
  "desde=2026-02-30",
  "hasta=2026-11-31",
  "desde=2026-13-01",
  "desde=2026-2-01",
  "desde=2026-12-01",
  "periodo=mes",
  "periodo=rango&periodo=rango",
  "desde=2026-11-01&desde=2026-11-02",
])("rejects invalid filters %s before queries", async (invalid) => {
  const query = new URLSearchParams(params);
  const overrides = new URLSearchParams(invalid);
  for (const key of new Set(overrides.keys())) query.delete(key);
  for (const [key, value] of overrides) query.append(key, value);
  const response = await GET(request(query.toString()));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "INVALID_FILTER" });
  expect(db.transaction).not.toHaveBeenCalled();
});
it.each(["periodo", "desde", "hasta"])("rejects missing %s", async (key) => {
  const query = new URLSearchParams(params);
  query.delete(key);
  expect((await GET(request(query.toString()))).status).toBe(400);
  expect(db.transaction).not.toHaveBeenCalled();
});
it.each([0, -1, 1.5, NaN, Infinity, 1000001])(
  "guards invalid direct page %s",
  async (page) => {
    await expect(getConsolidatedCollections(range, page)).rejects.toThrow(
      "INVALID_PAGE",
    );
    expect(db.transaction).not.toHaveBeenCalled();
  },
);
it.each(["count", "findMany", "transaction"] as const)(
  "sanitizes %s database failures",
  async (method) => {
    db[method].mockRejectedValue(
      new Error("private database password customer@example.test"),
    );
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "UNAVAILABLE" });
  },
);
