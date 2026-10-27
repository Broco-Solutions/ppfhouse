import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import {
  calculatePurchaseLine,
  sumPurchaseTotal,
} from "@/modules/purchases/domain/purchase-calculator";
import {
  purchaseInputSchema,
  supplierSchema,
  type PurchaseInput,
} from "@/modules/purchases/domain/purchase-schema";
import { businessLocalDateTimeToUtc } from "@/shared/date-time/business-time";
import { normalizeMoneyInput } from "@/modules/money/domain/money";

interface Actor {
  id: string;
}

function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function civilDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function nextPurchaseNumber(tx: Prisma.TransactionClient, year: number) {
  const sequence = await tx.purchaseSequence.upsert({
    where: { year },
    create: { year, nextValue: 1 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  return `COM-${year}-${String(sequence.nextValue).padStart(4, "0")}`;
}

export async function createSupplier(input: unknown, actor: Actor) {
  const data = supplierSchema.parse(input);
  return prisma.supplier.create({
    data: {
      ...data,
      createdById: actor.id,
      updatedById: actor.id,
    },
    select: { id: true },
  });
}

export async function setSupplierActive(
  supplierId: string,
  active: boolean,
  actor: Actor,
) {
  return prisma.supplier.update({
    where: { id: supplierId },
    data: { active, updatedById: actor.id },
    select: { id: true },
  });
}

export async function listSuppliers(activeOnly = false) {
  return prisma.supplier.findMany({
    where: activeOnly ? { active: true } : undefined,
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      active: true,
      _count: { select: { purchases: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

async function purchaseReplay(key: string, hash: string) {
  const existing = await prisma.idempotencyKey.findUnique({
    where: { operation_key: { operation: "POST_PURCHASE", key } },
  });
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
  if (!existing.resultReference) throw new Error("IDEMPOTENCY_INCOMPLETE");
  return { id: existing.resultReference, replayed: true as const };
}

export async function postPurchase(input: PurchaseInput, actor: Actor) {
  const data = purchaseInputSchema.parse(input);
  const hash = requestHash(data);
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyKey.findUnique({
        where: {
          operation_key: {
            operation: "POST_PURCHASE",
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

      const supplier = await tx.supplier.findFirst({
        where: { id: data.supplierId, active: true },
        select: { id: true },
      });
      if (!supplier) throw new Error("SUPPLIER_NOT_AVAILABLE");

      const itemIds = [...new Set(data.items.map((line) => line.itemId))];
      const presentationIds = data.items
        .map((line) => line.presentationId)
        .filter((id): id is string => Boolean(id));
      const items = await tx.inventoryItem.findMany({
        where: { id: { in: itemIds }, active: true },
        select: { id: true, name: true, baseUnit: true },
      });
      const presentations = await tx.purchasePresentation.findMany({
        where: { id: { in: presentationIds }, active: true },
        select: { id: true, itemId: true, name: true, factorToBase: true },
      });
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const presentationMap = new Map(
        presentations.map((presentation) => [presentation.id, presentation]),
      );
      const lines = data.items.map((line, sortOrder) => {
        const item = itemMap.get(line.itemId);
        if (!item) throw new Error("INVENTORY_ITEM_NOT_AVAILABLE");
        const presentation = line.presentationId
          ? presentationMap.get(line.presentationId)
          : undefined;
        if (line.presentationId && presentation?.itemId !== item.id)
          throw new Error("PRESENTATION_ITEM_MISMATCH");
        const sourceCost = normalizeMoneyInput({
          currency: data.currency,
          amount: line.unitCostUsd,
          exchangeRateArsPerUsd: data.exchangeRateArsPerUsd,
        });
        const values = calculatePurchaseLine({
          quantityPurchased: line.quantityPurchased,
          factorToBase: presentation?.factorToBase ?? "1",
          unitCostUsd: sourceCost.amountUsd,
        });
        const sourceTotal = new Prisma.Decimal(line.quantityPurchased)
          .mul(sourceCost.sourceAmount)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        const convertedTotal = normalizeMoneyInput({
          currency: data.currency,
          amount: sourceTotal.toFixed(2),
          exchangeRateArsPerUsd: data.exchangeRateArsPerUsd,
        }).amountUsd;
        return {
          ...values,
          totalUsd: convertedTotal,
          sourceUnitCost: sourceCost.sourceAmount,
          sourceTotal,
          sortOrder,
          item,
          presentationId: presentation?.id ?? null,
          presentationName:
            presentation?.name ?? `Unidad base (${item.baseUnit})`,
        };
      });
      const totalUsd = sumPurchaseTotal(lines);
      const sourceTotal = lines.reduce(
        (sum, line) => sum.plus(line.sourceTotal),
        new Prisma.Decimal(0),
      );
      const year = Number(data.businessDate.slice(0, 4));
      const number = await nextPurchaseNumber(tx, year);
      const purchase = await tx.purchase.create({
        data: {
          supplierId: supplier.id,
          number,
          businessDate: civilDate(data.businessDate),
          reference: data.reference,
          notes: data.notes,
          totalUsd,
          sourceCurrency: data.currency,
          sourceTotal,
          exchangeRateArsPerUsd:
            data.currency === "ARS" ? data.exchangeRateArsPerUsd : null,
          createdById: actor.id,
        },
        select: { id: true },
      });

      for (const line of lines) {
        const purchaseItem = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            itemId: line.item.id,
            presentationId: line.presentationId,
            itemNameSnapshot: line.item.name,
            presentationNameSnapshot: line.presentationName,
            baseUnitSnapshot: line.item.baseUnit,
            factorToBaseSnapshot: line.factorToBase,
            quantityPurchased: line.quantityPurchased,
            quantityBase: line.quantityBase,
            unitCostUsd: line.unitCostUsd,
            sourceUnitCost: line.sourceUnitCost,
            sourceTotal: line.sourceTotal,
            totalUsd: line.totalUsd,
            sortOrder: line.sortOrder,
          },
          select: { id: true },
        });
        await tx.inventoryItem.update({
          where: { id: line.item.id },
          data: { currentStock: { increment: line.quantityBase } },
        });
        await tx.inventoryMovement.create({
          data: {
            itemId: line.item.id,
            type: "PURCHASE",
            signedQuantityBase: line.quantityBase,
            unitSnapshot: line.item.baseUnit,
            occurredAt: businessLocalDateTimeToUtc(
              `${data.businessDate}T12:00`,
            ),
            note: `Compra ${number}`,
            purchaseItemId: purchaseItem.id,
            createdById: actor.id,
          },
        });
      }
      await tx.financialEntry.create({
        data: {
          direction: "OUTFLOW",
          type: "PURCHASE",
          amountUsd: totalUsd,
          sourceCurrency: data.currency,
          sourceAmount: sourceTotal,
          exchangeRateArsPerUsd:
            data.currency === "ARS" ? data.exchangeRateArsPerUsd : null,
          occurredAt: businessLocalDateTimeToUtc(`${data.businessDate}T12:00`),
          description: `Compra ${number}`,
          purchaseId: purchase.id,
          createdById: actor.id,
        },
      });
      await tx.idempotencyKey.create({
        data: {
          operation: "POST_PURCHASE",
          key: data.idempotencyKey,
          actorId: actor.id,
          requestHash: hash,
          resultReference: purchase.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
        },
      });
      return { id: purchase.id, replayed: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const replay = await purchaseReplay(data.idempotencyKey, hash);
      if (replay) return replay;
    }
    throw error;
  }
}

export async function voidPurchase(
  input: { purchaseId: string; reason: string },
  actor: Actor,
) {
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 300)
    throw new Error("INVALID_REASON");
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: input.purchaseId },
      select: {
        id: true,
        number: true,
        status: true,
        items: {
          select: {
            itemId: true,
            inventoryMovement: {
              select: {
                id: true,
                signedQuantityBase: true,
                unitSnapshot: true,
                reversedBy: { select: { id: true } },
              },
            },
          },
        },
        financialEntry: {
          select: {
            id: true,
            amountUsd: true,
            sourceCurrency: true,
            sourceAmount: true,
            exchangeRateArsPerUsd: true,
            reversedBy: { select: { id: true } },
          },
        },
      },
    });
    if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
    if (purchase.status === "VOIDED")
      return { id: purchase.id, replayed: true };
    if (!purchase.financialEntry || purchase.financialEntry.reversedBy)
      throw new Error("PURCHASE_LEDGER_INCONSISTENT");
    if (
      purchase.items.some(
        (item) => !item.inventoryMovement || item.inventoryMovement.reversedBy,
      )
    )
      throw new Error("PURCHASE_LEDGER_INCONSISTENT");

    const claimed = await tx.purchase.updateMany({
      where: { id: purchase.id, status: "POSTED" },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidReason: reason,
        voidedById: actor.id,
      },
    });
    if (claimed.count !== 1) throw new Error("PURCHASE_ALREADY_VOIDED");

    for (const line of purchase.items) {
      const movement = line.inventoryMovement!;
      const updated = await tx.inventoryItem.updateMany({
        where: {
          id: line.itemId,
          currentStock: { gte: movement.signedQuantityBase },
        },
        data: {
          currentStock: { decrement: movement.signedQuantityBase },
        },
      });
      if (updated.count !== 1) throw new Error("PURCHASE_STOCK_ALREADY_USED");
      await tx.inventoryMovement.create({
        data: {
          itemId: line.itemId,
          type: "REVERSAL",
          signedQuantityBase: movement.signedQuantityBase.negated(),
          unitSnapshot: movement.unitSnapshot,
          occurredAt: new Date(),
          note: `Anulación ${purchase.number}: ${reason}`,
          reversalOfId: movement.id,
          createdById: actor.id,
        },
      });
    }
    await tx.financialEntry.create({
      data: {
        direction: "INFLOW",
        type: "REVERSAL",
        amountUsd: purchase.financialEntry.amountUsd,
        sourceCurrency: purchase.financialEntry.sourceCurrency,
        sourceAmount: purchase.financialEntry.sourceAmount,
        exchangeRateArsPerUsd: purchase.financialEntry.exchangeRateArsPerUsd,
        occurredAt: new Date(),
        description: `Anulación ${purchase.number}: ${reason}`,
        reversalOfId: purchase.financialEntry.id,
        createdById: actor.id,
      },
    });
    return { id: purchase.id, replayed: false };
  });
}

export async function listPurchaseOptions() {
  const [suppliers, items] = await Promise.all([
    listSuppliers(true),
    prisma.inventoryItem.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        baseUnit: true,
        presentations: {
          where: { active: true },
          select: { id: true, name: true, factorToBase: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return { suppliers, items };
}

export async function listPurchases(options: {
  query?: string;
  status?: "POSTED" | "VOIDED";
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const query = options.query?.trim();
  const where: Prisma.PurchaseWhereInput = {
    status: options.status,
    OR: query
      ? [
          { number: { contains: query, mode: "insensitive" } },
          { reference: { contains: query, mode: "insensitive" } },
          { supplier: { name: { contains: query, mode: "insensitive" } } },
        ]
      : undefined,
  };
  const [items, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      select: {
        id: true,
        number: true,
        businessDate: true,
        totalUsd: true,
        sourceCurrency: true,
        sourceTotal: true,
        exchangeRateArsPerUsd: true,
        status: true,
        supplier: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ businessDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * 20,
      take: 20,
    }),
    prisma.purchase.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
}

export async function getPurchaseDetail(id: string) {
  return prisma.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      number: true,
      businessDate: true,
      reference: true,
      notes: true,
      totalUsd: true,
      sourceCurrency: true,
      sourceTotal: true,
      exchangeRateArsPerUsd: true,
      status: true,
      voidedAt: true,
      voidReason: true,
      supplier: { select: { name: true } },
      financialEntry: {
        select: {
          id: true,
          amountUsd: true,
          sourceCurrency: true,
          sourceAmount: true,
          exchangeRateArsPerUsd: true,
          reversedBy: { select: { id: true } },
        },
      },
      items: {
        select: {
          id: true,
          itemNameSnapshot: true,
          presentationNameSnapshot: true,
          baseUnitSnapshot: true,
          factorToBaseSnapshot: true,
          quantityPurchased: true,
          quantityBase: true,
          unitCostUsd: true,
          sourceUnitCost: true,
          sourceTotal: true,
          totalUsd: true,
          inventoryMovement: {
            select: { id: true, reversedBy: { select: { id: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}
