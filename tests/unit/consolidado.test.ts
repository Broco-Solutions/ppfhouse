import { afterEach, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/infrastructure/db/client", () => ({
  prisma: { financialEntry: db },
}));
import {
  authorized,
  periodRange,
  summary,
} from "@/modules/finance/application/consolidado";
import { GET } from "@/app/api/consolidado/resumen/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const params = new URLSearchParams({
  periodo: "rango",
  desde: "2026-10-01",
  hasta: "2026-10-31",
});
it("fails closed with absent, invalid and short keys; accepts only the configured key", () => {
  const request = (key?: string) =>
    new Request("https://local.test", {
      headers: key ? { "x-api-key": key } : {},
    });
  vi.stubEnv("CONSOLIDADO_API_KEY", "");
  expect(authorized(request())).toBe(false);
  vi.stubEnv("CONSOLIDADO_API_KEY", "a".repeat(32));
  expect(authorized(request())).toBe(false);
  expect(authorized(request("b".repeat(32)))).toBe(false);
  expect(authorized(request("a".repeat(32)))).toBe(true);
});
it("uses Argentine exclusive end and rejects impossible days", () => {
  const range = periodRange(params);
  expect(range.start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  expect(range.end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  expect(() =>
    periodRange(
      new URLSearchParams({
        periodo: "rango",
        desde: "2026-02-30",
        hasta: "2026-03-01",
      }),
    ),
  ).toThrow();
});
it("selects payments, refunds and only their reversals by effective date, without personal fields", async () => {
  db.findMany.mockResolvedValue([
    { direction: "INFLOW", amountUsd: "100.00" }, // normal
    { direction: "INFLOW", amountUsd: "20.10" }, // deposit
    { direction: "INFLOW", amountUsd: "0.20" }, // partial
    { direction: "OUTFLOW", amountUsd: "10.00" }, // refund
    { direction: "OUTFLOW", amountUsd: "30.00" }, // reversal of older payment
    { direction: "INFLOW", amountUsd: "5.00" }, // reversal of older refund
  ]);
  const range = periodRange(params);
  const result = await summary(range);
  expect(result.cobros).toBe("85.30");
  expect(result.movimientos).toBe(6);
  expect(db.findMany).toHaveBeenCalledWith({
    where: {
      occurredAt: { gte: range.start, lt: range.end },
      OR: [
        { type: { in: ["CUSTOMER_PAYMENT", "CUSTOMER_REFUND"] } },
        {
          type: "REVERSAL",
          reversalOf: {
            is: { type: { in: ["CUSTOMER_PAYMENT", "CUSTOMER_REFUND"] } },
          },
        },
      ],
    },
    select: { direction: true, amountUsd: true },
  });
  expect(result.periodo.hasta).toBe("2026-11-01T02:59:59.999Z");
});
it("returns exact zero with no movements", async () => {
  db.findMany.mockResolvedValue([]);
  expect((await summary(periodRange(params))).cobros).toBe("0.00");
});
it("rejects before querying and sanitizes unavailable errors", async () => {
  vi.stubEnv("CONSOLIDADO_API_KEY", "a".repeat(32));
  expect((await GET(new Request("https://local.test?" + params))).status).toBe(
    401,
  );
  expect(db.findMany).not.toHaveBeenCalled();
  db.findMany.mockRejectedValue(new Error("private detail"));
  const response = await GET(
    new Request("https://local.test?" + params, {
      headers: { "x-api-key": "a".repeat(32) },
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private");
});
