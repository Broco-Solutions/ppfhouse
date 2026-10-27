import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import {
  getAdminDashboard,
  getOperationalDashboard,
} from "@/modules/dashboard/application/dashboard-service";
import { globalSearch } from "@/modules/search/application/search-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
let actorId = "";
let clientId = "";
let vehicleId = "";
let caseId = "";
let undefinedCaseId = "";
let categoryId = "";
let itemId = "";
let serviceCategoryId = "";
let serviceId = "";
let incomeCategoryId = "";
let expenseCategoryId = "";

describe("dashboard semantics and permission-aware search", () => {
  beforeAll(async () => {
    actorId = (
      await prisma.user.create({
        data: {
          name: `Dashboard ${suffix}`,
          email: `dashboard-${suffix}@ferraro.test`,
          role: "ADMIN",
          emailVerified: true,
        },
      })
    ).id;
    incomeCategoryId = (
      await prisma.financialCategory.create({
        data: { name: `Dashboard income ${suffix}`, direction: "INFLOW" },
      })
    ).id;
    expenseCategoryId = (
      await prisma.financialCategory.create({
        data: { name: `Dashboard expense ${suffix}`, direction: "OUTFLOW" },
      })
    ).id;
    clientId = (
      await prisma.client.create({
        data: { displayName: `Dashboard M3 ${suffix}` },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "BMW", model: `M3 ${suffix}` },
      })
    ).id;
    caseId = (
      await prisma.serviceCase.create({
        data: {
          clientId,
          vehicleId,
          origin: "DIRECT_JOB",
          agreedAmountUsd: "1000",
          agreedSourceCurrency: "USD",
          agreedSourceAmount: "1000",
        },
      })
    ).id;
    await prisma.job.create({
      data: {
        serviceCaseId: caseId,
        performedAt: new Date("2032-01-15T15:00:00Z"),
      },
    });
    undefinedCaseId = (
      await prisma.serviceCase.create({
        data: { clientId, vehicleId, origin: "DIRECT_JOB" },
      })
    ).id;
    await prisma.job.create({
      data: {
        serviceCaseId: undefinedCaseId,
        performedAt: new Date("2032-01-16T15:00:00Z"),
      },
    });
    const payment = await prisma.financialEntry.create({
      data: {
        direction: "INFLOW",
        type: "CUSTOMER_PAYMENT",
        amountUsd: "200",
        sourceAmount: "200",
        occurredAt: new Date("2032-01-15T16:00:00Z"),
        serviceCaseId: caseId,
      },
    });
    await prisma.financialEntry.create({
      data: {
        direction: "OUTFLOW",
        type: "CUSTOMER_REFUND",
        amountUsd: "50",
        sourceAmount: "50",
        occurredAt: new Date("2032-01-16T16:00:00Z"),
        serviceCaseId: caseId,
      },
    });
    const secondPayment = await prisma.financialEntry.create({
      data: {
        direction: "INFLOW",
        type: "CUSTOMER_PAYMENT",
        amountUsd: "100",
        sourceAmount: "100",
        occurredAt: new Date("2032-01-17T16:00:00Z"),
        serviceCaseId: caseId,
      },
    });
    await prisma.financialEntry.create({
      data: {
        direction: "OUTFLOW",
        type: "REVERSAL",
        amountUsd: "100",
        sourceAmount: "100",
        occurredAt: new Date("2032-01-18T16:00:00Z"),
        serviceCaseId: caseId,
        reversalOfId: secondPayment.id,
      },
    });
    await prisma.financialEntry.create({
      data: {
        direction: "INFLOW",
        type: "MANUAL_INCOME",
        amountUsd: "70",
        sourceAmount: "70",
        occurredAt: new Date("2032-01-19T16:00:00Z"),
        description: `dashboard-${suffix}`,
        categoryId: incomeCategoryId,
      },
    });
    await prisma.financialEntry.create({
      data: {
        direction: "OUTFLOW",
        type: "MANUAL_EXPENSE",
        amountUsd: "30",
        sourceAmount: "30",
        occurredAt: new Date("2032-01-20T16:00:00Z"),
        description: `dashboard-${suffix}`,
        categoryId: expenseCategoryId,
      },
    });
    expect(payment.id).toBeTruthy();
    await prisma.appointment.create({
      data: {
        serviceCaseId: caseId,
        startAt: new Date("2032-01-15T13:00:00Z"),
        endAt: new Date("2032-01-15T17:00:00Z"),
      },
    });
    categoryId = (
      await prisma.inventoryCategory.create({
        data: { name: `Dashboard stock ${suffix}` },
      })
    ).id;
    itemId = (
      await prisma.inventoryItem.create({
        data: {
          categoryId,
          name: `PPF low ${suffix}`,
          baseUnit: "meter",
          currentStock: "2",
          minimumStock: "3",
        },
      })
    ).id;
    serviceCategoryId = (
      await prisma.serviceCategory.create({
        data: { name: `Dashboard service ${suffix}` },
      })
    ).id;
    serviceId = (
      await prisma.service.create({
        data: {
          categoryId: serviceCategoryId,
          name: `M3 Protection ${suffix}`,
          basePriceUsd: "999",
        },
      })
    ).id;
    await prisma.quote.create({
      data: {
        clientId,
        vehicleId,
        number: `PRE-2032-${suffix}`,
        status: "SENT",
        issuedOn: new Date("2032-01-01T00:00:00Z"),
        validUntil: new Date("2032-01-10T00:00:00Z"),
        subtotalUsd: "1000",
        sourceSubtotal: "1000",
        sourceDiscount: "0",
        sourceTotal: "1000",
        totalUsd: "1000",
        createdById: actorId,
      },
    });
  });

  afterAll(async () => {
    await prisma.quote.deleteMany({ where: { clientId } });
    await prisma.financialEntry.deleteMany({
      where: {
        OR: [
          { serviceCaseId: { in: [caseId, undefinedCaseId] } },
          { description: `dashboard-${suffix}` },
        ],
      },
    });
    await prisma.appointment.deleteMany({
      where: { serviceCaseId: { in: [caseId, undefinedCaseId] } },
    });
    await prisma.job.deleteMany({
      where: { serviceCaseId: { in: [caseId, undefinedCaseId] } },
    });
    await prisma.serviceCase.deleteMany({
      where: { id: { in: [caseId, undefinedCaseId] } },
    });
    if (serviceId) await prisma.service.delete({ where: { id: serviceId } });
    if (serviceCategoryId)
      await prisma.serviceCategory.delete({ where: { id: serviceCategoryId } });
    if (itemId) await prisma.inventoryItem.delete({ where: { id: itemId } });
    if (categoryId)
      await prisma.inventoryCategory.delete({ where: { id: categoryId } });
    if (incomeCategoryId || expenseCategoryId)
      await prisma.financialCategory.deleteMany({
        where: {
          id: { in: [incomeCategoryId, expenseCategoryId].filter(Boolean) },
        },
      });
    if (vehicleId) await prisma.vehicle.delete({ where: { id: vehicleId } });
    if (clientId) await prisma.client.delete({ where: { id: clientId } });
    if (actorId) await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("separates customer collection, cash flow, agreed ticket and pending balance", async () => {
    const result = await getAdminDashboard(new Date("2032-01-15T18:00:00Z"));
    expect(result.collectedUsd.toFixed(2)).toBe("150.00");
    expect(result.outflowUsd.toFixed(2)).toBe("180.00");
    expect(result.cashNetUsd.toFixed(2)).toBe("190.00");
    expect(result.jobsThisMonth).toBe(2);
    expect(result.averageAgreedUsd.toFixed(2)).toBe("1000.00");
    expect(result.pendingBalanceUsd.toFixed(2)).toBe("850.00");
    expect(result.undefinedAmountCases.map((item) => item.id)).toContain(
      undefinedCaseId,
    );
    expect(result.expiredQuotes).toHaveLength(1);
  });

  it("uses Buenos Aires day boundaries for today and exposes stock action", async () => {
    const result = await getOperationalDashboard(
      new Date("2032-01-15T18:00:00Z"),
    );
    expect(result.todayAppointments).toHaveLength(1);
    expect(result.lowStock.map((item) => item.id)).toContain(itemId);
  });

  it("finds M3 while omitting quote and price projections for STAFF", async () => {
    const admin = await globalSearch("M3", "ADMIN");
    const staff = await globalSearch("M3", "STAFF");
    expect(admin.vehicles.map((item) => item.id)).toContain(vehicleId);
    expect(admin.quotes.some((item) => item.number.endsWith(suffix))).toBe(
      true,
    );
    expect(staff.vehicles.map((item) => item.id)).toContain(vehicleId);
    expect(staff.services.map((item) => item.id)).toContain(serviceId);
    expect(staff.quotes).toEqual([]);
    expect(staff.services.find((item) => item.id === serviceId)).toEqual({
      id: serviceId,
      name: `M3 Protection ${suffix}`,
      active: true,
      estimatedDurationMinutes: null,
      category: { name: `Dashboard service ${suffix}` },
    });
    for (const job of staff.jobs) {
      expect(Object.keys(job.serviceCase).sort()).toEqual([
        "client",
        "vehicle",
      ]);
    }
  });
});
