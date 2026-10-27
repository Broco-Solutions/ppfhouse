import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  addConsumptionSchema,
  correctConsumptionSchema,
  reverseConsumptionSchema,
  type AddConsumptionInput,
  type CorrectConsumptionInput,
} from "@/modules/job-consumptions/domain/consumption-schema";

interface Actor {
  id: string;
}

function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function lockJob(tx: Prisma.TransactionClient, jobId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "jobs" WHERE "id" = ${jobId}::uuid FOR UPDATE`,
  );
  if (!rows.length) throw new Error("JOB_NOT_FOUND");
}

async function replay(
  operation: string,
  key: string,
  hash: string,
): Promise<{ id: string; replayed: true } | null> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { operation_key: { operation, key } },
  });
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
  if (!existing.resultReference) throw new Error("IDEMPOTENCY_INCOMPLETE");
  return { id: existing.resultReference, replayed: true };
}

export async function addJobConsumption(
  input: AddConsumptionInput,
  actor: Actor,
) {
  const data = addConsumptionSchema.parse(input);
  const hash = requestHash(data);
  const quantity = new Prisma.Decimal(data.quantityBase);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({
        where: {
          operation_key: {
            operation: "ADD_JOB_CONSUMPTION",
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
      await lockJob(tx, data.jobId);
      const [job, item] = await Promise.all([
        tx.job.findUnique({
          where: { id: data.jobId },
          select: { id: true, voidedAt: true },
        }),
        tx.inventoryItem.findFirst({
          where: { id: data.itemId, active: true },
          select: { id: true, baseUnit: true },
        }),
      ]);
      if (!job || job.voidedAt) throw new Error("JOB_NOT_AVAILABLE");
      if (!item) throw new Error("INVENTORY_ITEM_NOT_AVAILABLE");
      const updated = await tx.inventoryItem.updateMany({
        where: { id: item.id, currentStock: { gte: quantity } },
        data: { currentStock: { decrement: quantity } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      const consumption = await tx.jobMaterialConsumption.create({
        data: {
          jobId: job.id,
          itemId: item.id,
          quantityBase: quantity,
          unitSnapshot: item.baseUnit,
          note: data.note,
          createdById: actor.id,
        },
        select: { id: true },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          type: "CONSUMPTION",
          signedQuantityBase: quantity.negated(),
          unitSnapshot: item.baseUnit,
          occurredAt: new Date(),
          note: `Consumo de trabajo${data.note ? `: ${data.note}` : ""}`,
          consumptionId: consumption.id,
          createdById: actor.id,
        },
      });
      await tx.idempotencyKey.create({
        data: {
          operation: "ADD_JOB_CONSUMPTION",
          key: data.idempotencyKey,
          actorId: actor.id,
          requestHash: hash,
          resultReference: consumption.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return { id: consumption.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await replay(
        "ADD_JOB_CONSUMPTION",
        data.idempotencyKey,
        hash,
      );
      if (existing) return existing;
    }
    throw error;
  }
}

export async function correctJobConsumption(
  input: CorrectConsumptionInput,
  actor: Actor,
) {
  const data = correctConsumptionSchema.parse(input);
  const hash = requestHash(data);
  const quantity = new Prisma.Decimal(data.quantityBase);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({
        where: {
          operation_key: {
            operation: "CORRECT_JOB_CONSUMPTION",
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
      const original = await tx.jobMaterialConsumption.findUnique({
        where: { id: data.consumptionId },
        select: {
          id: true,
          jobId: true,
          itemId: true,
          quantityBase: true,
          unitSnapshot: true,
          replacedBy: { select: { id: true } },
          movement: {
            select: { id: true, reversedBy: { select: { id: true } } },
          },
        },
      });
      if (!original) throw new Error("CONSUMPTION_NOT_FOUND");
      await lockJob(tx, original.jobId);
      const job = await tx.job.findUnique({
        where: { id: original.jobId },
        select: { voidedAt: true },
      });
      if (job?.voidedAt) throw new Error("JOB_NOT_AVAILABLE");
      if (
        original.replacedBy ||
        !original.movement ||
        original.movement.reversedBy
      )
        throw new Error("CONSUMPTION_NOT_ACTIVE");

      const replacement = await tx.jobMaterialConsumption.create({
        data: {
          jobId: original.jobId,
          itemId: original.itemId,
          quantityBase: quantity,
          unitSnapshot: original.unitSnapshot,
          note: data.reason,
          replacesId: original.id,
          createdById: actor.id,
        },
        select: { id: true },
      });
      await tx.inventoryItem.update({
        where: { id: original.itemId },
        data: { currentStock: { increment: original.quantityBase } },
      });
      await tx.inventoryMovement.create({
        data: {
          itemId: original.itemId,
          type: "REVERSAL",
          signedQuantityBase: original.quantityBase,
          unitSnapshot: original.unitSnapshot,
          occurredAt: new Date(),
          note: `Corrección de consumo: ${data.reason}`,
          reversalOfId: original.movement.id,
          createdById: actor.id,
        },
      });
      const updated = await tx.inventoryItem.updateMany({
        where: { id: original.itemId, currentStock: { gte: quantity } },
        data: { currentStock: { decrement: quantity } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      await tx.inventoryMovement.create({
        data: {
          itemId: original.itemId,
          type: "CONSUMPTION",
          signedQuantityBase: quantity.negated(),
          unitSnapshot: original.unitSnapshot,
          occurredAt: new Date(),
          note: `Consumo corregido: ${data.reason}`,
          consumptionId: replacement.id,
          createdById: actor.id,
        },
      });
      await tx.idempotencyKey.create({
        data: {
          operation: "CORRECT_JOB_CONSUMPTION",
          key: data.idempotencyKey,
          actorId: actor.id,
          requestHash: hash,
          resultReference: replacement.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return { id: replacement.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await replay(
        "CORRECT_JOB_CONSUMPTION",
        data.idempotencyKey,
        hash,
      );
      if (existing) return existing;
    }
    throw error;
  }
}

export async function reverseJobConsumption(input: unknown, actor: Actor) {
  const data = reverseConsumptionSchema.parse(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const consumption = await tx.jobMaterialConsumption.findUnique({
        where: { id: data.consumptionId },
        select: {
          id: true,
          jobId: true,
          itemId: true,
          quantityBase: true,
          unitSnapshot: true,
          replacedBy: { select: { id: true } },
          movement: {
            select: { id: true, reversedBy: { select: { id: true } } },
          },
        },
      });
      if (!consumption) throw new Error("CONSUMPTION_NOT_FOUND");
      await lockJob(tx, consumption.jobId);
      const job = await tx.job.findUnique({
        where: { id: consumption.jobId },
        select: { voidedAt: true },
      });
      if (job?.voidedAt) throw new Error("JOB_NOT_AVAILABLE");
      if (consumption.replacedBy) throw new Error("CONSUMPTION_NOT_ACTIVE");
      if (!consumption.movement)
        throw new Error("CONSUMPTION_LEDGER_INCONSISTENT");
      if (consumption.movement.reversedBy)
        return { id: consumption.movement.reversedBy.id, replayed: true };
      await tx.inventoryItem.update({
        where: { id: consumption.itemId },
        data: { currentStock: { increment: consumption.quantityBase } },
      });
      const reversal = await tx.inventoryMovement.create({
        data: {
          itemId: consumption.itemId,
          type: "REVERSAL",
          signedQuantityBase: consumption.quantityBase,
          unitSnapshot: consumption.unitSnapshot,
          occurredAt: new Date(),
          note: `Anulación de consumo: ${data.reason}`,
          reversalOfId: consumption.movement.id,
          createdById: actor.id,
        },
        select: { id: true },
      });
      return { id: reversal.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const original = await prisma.jobMaterialConsumption.findUnique({
        where: { id: data.consumptionId },
        select: {
          movement: { select: { reversedBy: { select: { id: true } } } },
        },
      });
      if (original?.movement?.reversedBy)
        return { id: original.movement.reversedBy.id, replayed: true };
    }
    throw error;
  }
}

export async function listConsumptionOptions() {
  return prisma.inventoryItem.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      baseUnit: true,
      currentStock: true,
      category: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}
