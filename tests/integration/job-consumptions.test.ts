import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import { reconcileInventory } from "@/modules/inventory/application/inventory-service";
import {
  addJobConsumption,
  correctJobConsumption,
  reverseJobConsumption,
} from "@/modules/job-consumptions/application/consumption-service";
import { voidJob } from "@/modules/jobs/application/job-service";

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
let jobId = "";
let categoryId = "";
let itemId = "";

async function stock() {
  return (
    await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })
  ).currentStock.toFixed(3);
}

describe("job material consumptions", () => {
  beforeAll(async () => {
    actorId = (
      await prisma.user.create({
        data: {
          name: `Consumption actor ${suffix}`,
          email: `consumption-${suffix}@ferraro.test`,
          role: "STAFF",
          emailVerified: true,
        },
      })
    ).id;
    clientId = (
      await prisma.client.create({
        data: { displayName: `Cliente consumo ${suffix}` },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: {
          clientId,
          brand: "BMW",
          model: "M3",
          vehicleClass: "SEDAN",
        },
      })
    ).id;
    caseId = (
      await prisma.serviceCase.create({
        data: {
          clientId,
          vehicleId,
          origin: "DIRECT_JOB",
          createdById: actorId,
        },
      })
    ).id;
    jobId = (
      await prisma.job.create({
        data: {
          serviceCaseId: caseId,
          performedAt: new Date(),
          createdById: actorId,
        },
      })
    ).id;
    categoryId = (
      await prisma.inventoryCategory.create({
        data: { name: `Films consumo ${suffix}` },
      })
    ).id;
    itemId = (
      await prisma.inventoryItem.create({
        data: {
          categoryId,
          name: `PPF consumo ${suffix}`,
          baseUnit: "meter",
          currentStock: "10",
        },
      })
    ).id;
    await prisma.inventoryMovement.create({
      data: {
        itemId,
        type: "ADJUSTMENT_IN",
        signedQuantityBase: "10",
        unitSnapshot: "meter",
        occurredAt: new Date(),
        note: "Saldo inicial de prueba",
        createdById: actorId,
      },
    });
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { actorId } });
    await prisma.inventoryMovement.deleteMany({ where: { itemId } });
    await prisma.jobMaterialConsumption.deleteMany({ where: { jobId } });
    await prisma.job.delete({ where: { id: jobId } });
    await prisma.serviceCase.delete({ where: { id: caseId } });
    await prisma.inventoryItem.delete({ where: { id: itemId } });
    await prisma.inventoryCategory.delete({ where: { id: categoryId } });
    await prisma.vehicle.delete({ where: { id: vehicleId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("deducts 3.2 meters exactly and replays a duplicate submit", async () => {
    const key = randomUUID();
    const created = await addJobConsumption(
      {
        jobId,
        itemId,
        quantityBase: "3.200",
        note: "Frontal",
        idempotencyKey: key,
      },
      { id: actorId },
    );
    await expect(
      addJobConsumption(
        {
          jobId,
          itemId,
          quantityBase: "3.200",
          note: "Frontal",
          idempotencyKey: key,
        },
        { id: actorId },
      ),
    ).resolves.toMatchObject({ id: created.id, replayed: true });
    expect(await stock()).toBe("6.800");
    expect((await reconcileInventory(itemId))[0]?.matches).toBe(true);
  });

  it("corrects through compensation and keeps both historical records", async () => {
    const original = await prisma.jobMaterialConsumption.findFirstOrThrow({
      where: { jobId, replacesId: null },
    });
    const correction = await correctJobConsumption(
      {
        consumptionId: original.id,
        quantityBase: "2.400",
        reason: "Medición final",
        idempotencyKey: randomUUID(),
      },
      { id: actorId },
    );
    expect(await stock()).toBe("7.600");
    expect(
      await prisma.jobMaterialConsumption.count({ where: { jobId } }),
    ).toBe(2);
    expect(
      await prisma.jobMaterialConsumption.findUnique({
        where: { id: correction.id },
      }),
    ).toMatchObject({ replacesId: original.id });
    expect((await reconcileInventory(itemId))[0]?.matches).toBe(true);
  });

  it("rejects insufficient and concurrent deductions without corrupting stock", async () => {
    await expect(
      addJobConsumption(
        {
          jobId,
          itemId,
          quantityBase: "9",
          idempotencyKey: randomUUID(),
        },
        { id: actorId },
      ),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    const attempts = await Promise.allSettled([
      addJobConsumption(
        {
          jobId,
          itemId,
          quantityBase: "6",
          idempotencyKey: randomUUID(),
        },
        { id: actorId },
      ),
      addJobConsumption(
        {
          jobId,
          itemId,
          quantityBase: "6",
          idempotencyKey: randomUUID(),
        },
        { id: actorId },
      ),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await stock()).toBe("1.600");
    expect((await reconcileInventory(itemId))[0]?.matches).toBe(true);
    const fulfilled = attempts.find((result) => result.status === "fulfilled");
    if (fulfilled?.status === "fulfilled") {
      await reverseJobConsumption(
        {
          consumptionId: fulfilled.value.id,
          reason: "Limpieza de concurrencia",
        },
        { id: actorId },
      );
    }
    expect(await stock()).toBe("7.600");
  });

  it("reverses all active consumptions atomically when the job is voided", async () => {
    await voidJob(
      { jobId, reason: "Trabajo duplicado de prueba" },
      { id: actorId },
    );
    expect(await stock()).toBe("10.000");
    expect((await reconcileInventory(itemId))[0]?.matches).toBe(true);
    await expect(
      addJobConsumption(
        {
          jobId,
          itemId,
          quantityBase: "1",
          idempotencyKey: randomUUID(),
        },
        { id: actorId },
      ),
    ).rejects.toThrow("JOB_NOT_AVAILABLE");
  });
});
