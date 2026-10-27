import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import {
  adjustInventory,
  createInventoryCategory,
  createPurchasePresentation,
  getInventoryItemDetail,
  listInventoryItems,
  reconcileInventory,
  reverseInventoryMovement,
  saveInventoryItem,
} from "@/modules/inventory/application/inventory-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
let actorId = "";
let categoryId = "";
let itemId = "";
const movementIds: string[] = [];

describe("inventory core", () => {
  beforeAll(async () => {
    actorId = (
      await prisma.user.create({
        data: {
          name: `Inventory actor ${suffix}`,
          email: `inventory-${suffix}@ferraro.test`,
          role: "ADMIN",
          emailVerified: true,
        },
      })
    ).id;
    categoryId = (
      await createInventoryCategory(
        { name: `Films ${suffix}` },
        { id: actorId },
      )
    ).id;
    itemId = (
      await saveInventoryItem(
        undefined,
        {
          categoryId,
          name: `PPF X ${suffix}`,
          sku: `PPF-${suffix}`,
          baseUnit: "meter",
          minimumStock: "5",
          costHintUsd: "40",
          notes: "Film de prueba",
        },
        { id: actorId },
      )
    ).id;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({
      where: { resultReference: { in: movementIds } },
    });
    await prisma.inventoryMovement.deleteMany({ where: { itemId } });
    await prisma.purchasePresentation.deleteMany({ where: { itemId } });
    await prisma.inventoryItem.delete({ where: { id: itemId } });
    await prisma.inventoryCategory.delete({ where: { id: categoryId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("configures a 15 meter roll and keeps ADMIN cost out of STAFF projections", async () => {
    await createPurchasePresentation({
      itemId,
      name: "Rollo 15 m",
      factorToBase: "15",
    });
    const admin = await getInventoryItemDetail(itemId, true);
    const staff = await getInventoryItemDetail(itemId, false);
    expect(admin?.presentations[0]?.factorToBase.toString()).toBe("15");
    expect(admin).toHaveProperty("costHintUsd");
    expect(staff).not.toHaveProperty("costHintUsd");
    const list = await listInventoryItems({ includeCost: false });
    expect(list.items.find((item) => item.id === itemId)).not.toHaveProperty(
      "costHintUsd",
    );
  });

  it("updates aggregate and ledger atomically, is idempotent and locks the base unit", async () => {
    const key = randomUUID();
    const initial = await adjustInventory(
      {
        itemId,
        direction: "IN",
        quantityBase: "30.000",
        reason: "Conteo físico inicial",
        allowNegative: false,
        idempotencyKey: key,
      },
      { id: actorId },
    );
    movementIds.push(initial.id);
    await expect(
      adjustInventory(
        {
          itemId,
          direction: "IN",
          quantityBase: "30.000",
          reason: "Conteo físico inicial",
          allowNegative: false,
          idempotencyKey: key,
        },
        { id: actorId },
      ),
    ).resolves.toMatchObject({ id: initial.id, replayed: true });
    await expect(
      saveInventoryItem(
        itemId,
        {
          categoryId,
          name: `PPF X ${suffix}`,
          sku: `PPF-${suffix}`,
          baseUnit: "unit",
          minimumStock: "5",
          costHintUsd: "40",
          notes: "Film de prueba",
        },
        { id: actorId },
      ),
    ).rejects.toThrow("BASE_UNIT_LOCKED");
    expect((await reconcileInventory(itemId))[0]).toMatchObject({
      matches: true,
    });
  });

  it("serializes competing deductions so normal stock cannot become negative", async () => {
    const attempts = await Promise.allSettled([
      adjustInventory(
        {
          itemId,
          direction: "OUT",
          quantityBase: "20",
          reason: "Conteo concurrente A",
          allowNegative: false,
          idempotencyKey: randomUUID(),
        },
        { id: actorId },
      ),
      adjustInventory(
        {
          itemId,
          direction: "OUT",
          quantityBase: "20",
          reason: "Conteo concurrente B",
          allowNegative: false,
          idempotencyKey: randomUUID(),
        },
        { id: actorId },
      ),
    ]);
    const fulfilled = attempts.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (fulfilled[0]?.status === "fulfilled")
      movementIds.push(fulfilled[0].value.id);
    if (rejected[0]?.status === "rejected")
      expect(String(rejected[0].reason)).toContain("INSUFFICIENT_STOCK");
    const item = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.currentStock.toFixed(3)).toBe("10.000");
    expect((await reconcileInventory(itemId))[0]?.matches).toBe(true);
  });

  it("corrects by compensation without deleting the original movement", async () => {
    const original = movementIds.at(-1);
    expect(original).toBeTruthy();
    const reversal = await reverseInventoryMovement(
      { movementId: original!, reason: "Stock inicial incorrecto" },
      { id: actorId },
    );
    movementIds.push(reversal.id);
    const storedOriginal = await prisma.inventoryMovement.findUniqueOrThrow({
      where: { id: original! },
      include: { reversedBy: true },
    });
    expect(storedOriginal.reversedBy?.id).toBe(reversal.id);
    expect((await reconcileInventory(itemId))[0]?.matches).toBe(true);
  });
});
