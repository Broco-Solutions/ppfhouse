import { createHash } from "node:crypto";

import { Prisma, type InventoryMovementType } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  inventoryAdjustmentSchema,
  inventoryCategorySchema,
  inventoryItemSchema,
  presentationSchema,
  type InventoryAdjustmentInput,
  type InventoryItemInput,
} from "@/modules/inventory/domain/inventory-schema";
import { sumInventoryMovements } from "@/modules/inventory/domain/stock";

interface Actor {
  id: string;
}

function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function createInventoryCategory(input: unknown, actor: Actor) {
  const data = inventoryCategorySchema.parse(input);
  return prisma.inventoryCategory.create({
    data: { ...data, createdById: actor.id, updatedById: actor.id },
    select: { id: true },
  });
}

export async function setInventoryCategoryActive(
  categoryId: string,
  active: boolean,
  actor: Actor,
) {
  return prisma.inventoryCategory.update({
    where: { id: categoryId },
    data: { active, updatedById: actor.id },
    select: { id: true },
  });
}

export async function saveInventoryItem(
  itemId: string | undefined,
  input: InventoryItemInput,
  actor: Actor,
) {
  const data = inventoryItemSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const category = await tx.inventoryCategory.findFirst({
      where: { id: data.categoryId, active: true },
      select: { id: true },
    });
    if (!category) throw new Error("INVENTORY_CATEGORY_NOT_AVAILABLE");

    if (!itemId) {
      return tx.inventoryItem.create({
        data: {
          ...data,
          sku: data.sku || null,
          costHintUsd: data.costHintUsd || null,
          notes: data.notes || null,
          createdById: actor.id,
          updatedById: actor.id,
        },
        select: { id: true },
      });
    }

    const current = await tx.inventoryItem.findUnique({
      where: { id: itemId },
      select: { baseUnit: true, _count: { select: { movements: true } } },
    });
    if (!current) throw new Error("INVENTORY_ITEM_NOT_FOUND");
    if (current.baseUnit !== data.baseUnit && current._count.movements > 0)
      throw new Error("BASE_UNIT_LOCKED");

    return tx.inventoryItem.update({
      where: { id: itemId },
      data: {
        ...data,
        sku: data.sku || null,
        costHintUsd: data.costHintUsd || null,
        notes: data.notes || null,
        updatedById: actor.id,
      },
      select: { id: true },
    });
  });
}

export async function setInventoryItemActive(
  itemId: string,
  active: boolean,
  actor: Actor,
) {
  return prisma.inventoryItem.update({
    where: { id: itemId },
    data: { active, updatedById: actor.id },
    select: { id: true },
  });
}

export async function createPurchasePresentation(input: unknown) {
  const data = presentationSchema.parse(input);
  const item = await prisma.inventoryItem.findUnique({
    where: { id: data.itemId },
    select: { id: true },
  });
  if (!item) throw new Error("INVENTORY_ITEM_NOT_FOUND");
  return prisma.purchasePresentation.create({
    data,
    select: { id: true },
  });
}

export async function setPurchasePresentationActive(
  presentationId: string,
  active: boolean,
) {
  return prisma.purchasePresentation.update({
    where: { id: presentationId },
    data: { active },
    select: { id: true, itemId: true },
  });
}

async function replayedAdjustment(
  key: string,
  hash: string,
): Promise<{ id: string; replayed: true } | null> {
  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      operation_key: { operation: "ADJUST_INVENTORY", key },
    },
  });
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
  if (!existing.resultReference) throw new Error("IDEMPOTENCY_INCOMPLETE");
  return { id: existing.resultReference, replayed: true };
}

export async function adjustInventory(
  input: InventoryAdjustmentInput,
  actor: Actor,
) {
  const data = inventoryAdjustmentSchema.parse(input);
  const hash = requestHash(data);
  const quantity = new Prisma.Decimal(data.quantityBase);
  const signedQuantity =
    data.direction === "IN" ? quantity : quantity.negated();
  const type: InventoryMovementType =
    data.direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({
        where: {
          operation_key: {
            operation: "ADJUST_INVENTORY",
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

      const item = await tx.inventoryItem.findUnique({
        where: { id: data.itemId },
        select: { id: true, baseUnit: true },
      });
      if (!item) throw new Error("INVENTORY_ITEM_NOT_FOUND");

      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: item.id,
          ...(data.direction === "OUT" && !data.allowNegative
            ? { currentStock: { gte: quantity } }
            : {}),
        },
        data: { currentStock: { increment: signedQuantity } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          type,
          signedQuantityBase: signedQuantity,
          unitSnapshot: item.baseUnit,
          occurredAt: new Date(),
          note: data.reason,
          createdById: actor.id,
        },
        select: { id: true },
      });
      await tx.idempotencyKey.create({
        data: {
          operation: "ADJUST_INVENTORY",
          key: data.idempotencyKey,
          actorId: actor.id,
          requestHash: hash,
          resultReference: movement.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return { id: movement.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replayed = await replayedAdjustment(data.idempotencyKey, hash);
      if (replayed) return replayed;
    }
    throw error;
  }
}

export async function reverseInventoryMovement(
  input: { movementId: string; reason: string },
  actor: Actor,
) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 300)
    throw new Error("INVALID_REASON");
  try {
    return await prisma.$transaction(async (tx) => {
      const original = await tx.inventoryMovement.findUnique({
        where: { id: input.movementId },
        select: {
          id: true,
          itemId: true,
          type: true,
          signedQuantityBase: true,
          unitSnapshot: true,
        },
      });
      if (!original) throw new Error("INVENTORY_MOVEMENT_NOT_FOUND");
      if (original.type === "REVERSAL")
        throw new Error("REVERSAL_NOT_REVERSIBLE");
      const existing = await tx.inventoryMovement.findUnique({
        where: { reversalOfId: original.id },
        select: { id: true },
      });
      if (existing) return { id: existing.id, replayed: true };

      const compensation = original.signedQuantityBase.negated();
      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: original.itemId,
          ...(compensation.isNegative()
            ? { currentStock: { gte: compensation.abs() } }
            : {}),
        },
        data: { currentStock: { increment: compensation } },
      });
      if (updated.count !== 1) throw new Error("INSUFFICIENT_STOCK");
      const reversal = await tx.inventoryMovement.create({
        data: {
          itemId: original.itemId,
          type: "REVERSAL",
          signedQuantityBase: compensation,
          unitSnapshot: original.unitSnapshot,
          occurredAt: new Date(),
          note: `Reversión: ${reason}`,
          reversalOfId: original.id,
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
      const existing = await prisma.inventoryMovement.findUnique({
        where: { reversalOfId: input.movementId },
        select: { id: true },
      });
      if (existing) return { id: existing.id, replayed: true };
    }
    throw error;
  }
}

export async function listInventoryCategories(activeOnly = false) {
  return prisma.inventoryCategory.findMany({
    where: activeOnly ? { active: true } : undefined,
    select: {
      id: true,
      name: true,
      active: true,
      _count: { select: { items: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function listInventoryItems(options: {
  query?: string;
  categoryId?: string;
  status?: "active" | "archived" | "all";
  lowStock?: boolean;
  sort?: "name" | "stock";
  page?: number;
  pageSize?: number;
  includeCost: boolean;
}) {
  const query = options.query?.trim();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const where: Prisma.InventoryItemWhereInput = {
    active:
      options.status === "all"
        ? undefined
        : options.status === "archived"
          ? false
          : true,
    categoryId: options.categoryId || undefined,
    currentStock: options.lowStock
      ? { lte: prisma.inventoryItem.fields.minimumStock }
      : undefined,
    OR: query
      ? [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ]
      : undefined,
  };
  const select = {
    id: true,
    name: true,
    sku: true,
    baseUnit: true,
    currentStock: true,
    minimumStock: true,
    active: true,
    category: { select: { id: true, name: true } },
    ...(options.includeCost ? { costHintUsd: true } : {}),
  } satisfies Prisma.InventoryItemSelect;
  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      select,
      orderBy:
        options.sort === "stock"
          ? [{ currentStock: "asc" }, { name: "asc" }]
          : [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inventoryItem.count({ where }),
  ]);
  return {
    items,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getInventoryItemDetail(
  itemId: string,
  includeCost: boolean,
) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      sku: true,
      baseUnit: true,
      currentStock: true,
      minimumStock: true,
      notes: true,
      active: true,
      categoryId: true,
      category: { select: { name: true } },
      presentations: {
        select: {
          id: true,
          name: true,
          factorToBase: true,
          active: true,
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      },
      movements: {
        select: {
          id: true,
          type: true,
          signedQuantityBase: true,
          unitSnapshot: true,
          occurredAt: true,
          note: true,
          reversalOfId: true,
          reversedBy: { select: { id: true } },
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 50,
      },
      ...(includeCost ? { costHintUsd: true } : {}),
    },
  });
  return item;
}

export async function reconcileInventory(itemId?: string) {
  const items = await prisma.inventoryItem.findMany({
    where: itemId ? { id: itemId } : undefined,
    select: {
      id: true,
      name: true,
      currentStock: true,
      movements: { select: { signedQuantityBase: true } },
    },
  });
  return items.map((item) => {
    const ledgerStock = sumInventoryMovements(item.movements);
    return {
      id: item.id,
      name: item.name,
      currentStock: item.currentStock,
      ledgerStock,
      matches: item.currentStock.equals(ledgerStock),
    };
  });
}
