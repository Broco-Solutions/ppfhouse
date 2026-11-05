import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/infrastructure/db/client";
import { netCash } from "@/modules/finance/domain/balance";
import { businessDayRange } from "@/shared/date-time/business-time";

export const identity = {
  version: 1,
  empresaId: "ppf-house",
  moneda: "USD",
} as const;
export function authorized(request: Request) {
  const expected = process.env.CONSOLIDADO_API_KEY;
  const received = request.headers.get("x-api-key");
  if (!expected || expected.length < 32 || !received) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(expected), digest(received));
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
export function periodRange(params: URLSearchParams) {
  if (params.get("periodo") !== "rango") throw new Error("INVALID_PERIOD");
  const dates = ["desde", "hasta"].map((key) => {
    const value = params.get(key) ?? "";
    if (params.getAll(key).length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error("INVALID_PERIOD");
    return businessDayRange(value);
  });
  const start = dates[0]!.start;
  const end = dates[1]!.end;
  if (start >= end) throw new Error("INVALID_PERIOD");
  return { start, end };
}
export async function summary(range: { start: Date; end: Date }) {
  const entries = await prisma.financialEntry.findMany({
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
  return {
    ...identity,
    periodo: {
      desde: range.start.toISOString(),
      hasta: new Date(range.end.getTime() - 1).toISOString(),
    },
    cobros: netCash(entries).toFixed(2),
    movimientos: entries.length,
  };
}
