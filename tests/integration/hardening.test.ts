import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GET as healthCheck } from "@/app/api/health/route";
import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import { reconcileServiceCaseFinances } from "@/modules/finance/application/finance-reconciliation";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
let clientId = "";
let vehicleId = "";
let serviceCaseId = "";

describe("production readiness checks", () => {
  beforeAll(async () => {
    clientId = (
      await prisma.client.create({
        data: { displayName: `Hardening ${suffix}` },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "BMW", model: "M3" },
      })
    ).id;
    serviceCaseId = (
      await prisma.serviceCase.create({
        data: {
          clientId,
          vehicleId,
          origin: "DIRECT_APPOINTMENT",
          agreedAmountUsd: "100.00",
          agreedSourceCurrency: "USD",
          agreedSourceAmount: "100.00",
        },
      })
    ).id;
    await prisma.financialEntry.createMany({
      data: [
        {
          direction: "INFLOW",
          type: "CUSTOMER_PAYMENT",
          amountUsd: "30.00",
          sourceAmount: "30.00",
          occurredAt: new Date(),
          serviceCaseId,
        },
        {
          direction: "OUTFLOW",
          type: "CUSTOMER_REFUND",
          amountUsd: "10.00",
          sourceAmount: "10.00",
          occurredAt: new Date(),
          serviceCaseId,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.financialEntry.deleteMany({ where: { serviceCaseId } });
    await prisma.serviceCase.delete({ where: { id: serviceCaseId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.$disconnect();
  });

  it("reports database health without exposing internals", async () => {
    const response = await healthCheck();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("reconciles derived collection and balance against SQL aggregation", async () => {
    const result = (await reconcileServiceCaseFinances()).find(
      (item) => item.serviceCaseId === serviceCaseId,
    );
    expect(result?.matches).toBe(true);
    expect(result?.collectedUsd.toFixed(2)).toBe("20.00");
    expect(result?.balanceUsd?.toFixed(2)).toBe("80.00");
  });
});
