import {
  addJobConsumption,
  correctJobConsumption,
} from "@/modules/job-consumptions/application/consumption-service";
import * as privateStorage from "@/infrastructure/storage/private-storage";
import { cleanupDeletedRecordFiles } from "@/modules/deletion/application/storage-cleanup";
import { acceptQuote } from "@/modules/quotes/application/quote-service";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/infrastructure/db/client";
import { deleteRecord } from "@/modules/deletion/application/delete-record";
import { listDeletionRecords } from "@/modules/deletion/application/record-config";
import { recordKinds } from "@/modules/deletion/domain/records";
import {
  postPurchase,
  voidPurchase,
} from "@/modules/purchases/application/purchase-service";
import { reconcileInventory } from "@/modules/inventory/application/inventory-service";

const suffix = randomUUID();
let admin = "";
let staff = "";
const ids: string[] = [];
const keep = <T extends { id: string }>(row: T) => {
  ids.push(row.id);
  return row;
};
const erase = (kind: Parameters<typeof deleteRecord>[0], id: string) =>
  deleteRecord(kind, id, admin);
async function clientGraph() {
  const client = keep(
    await prisma.client.create({
      data: { displayName: `Delete ${suffix}`, createdById: admin },
    }),
  );
  const vehicle = keep(
    await prisma.vehicle.create({
      data: { clientId: client.id, brand: "Ford", model: "Fiesta" },
    }),
  );
  const serviceCase = keep(
    await prisma.serviceCase.create({
      data: {
        clientId: client.id,
        vehicleId: vehicle.id,
        origin: "DIRECT_APPOINTMENT",
      },
    }),
  );
  return { client, vehicle, serviceCase };
}
async function stockGraph() {
  const category = keep(
    await prisma.inventoryCategory.create({ data: { name: randomUUID() } }),
  );
  const item = keep(
    await prisma.inventoryItem.create({
      data: { categoryId: category.id, name: randomUUID(), baseUnit: "meter" },
    }),
  );
  const supplier = keep(
    await prisma.supplier.create({ data: { name: randomUUID() } }),
  );
  return { category, item, supplier };
}
async function purchase(itemId: string, supplierId: string) {
  const result = await postPurchase(
    {
      supplierId,
      businessDate: "2026-10-19",
      currency: "USD",
      idempotencyKey: randomUUID(),
      items: [{ itemId, quantityPurchased: "10", unitCostUsd: "3" }],
    },
    { id: admin },
  );
  ids.push(result.id);
  return result;
}
async function adjustment(itemId: string, quantity: number) {
  const row = keep(
    await prisma.inventoryMovement.create({
      data: {
        itemId,
        type: quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        signedQuantityBase: quantity,
        unitSnapshot: "meter",
        note: "Deletion test",
        occurredAt: new Date(),
      },
    }),
  );
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: { currentStock: { increment: quantity } },
  });
  return row;
}

describe("ADMIN permanent deletion", () => {
  beforeAll(async () => {
    admin = (
      await prisma.user.create({
        data: {
          name: "Delete admin",
          email: `delete-admin-${suffix}@test.com`,
          role: "ADMIN",
        },
      })
    ).id;
    staff = (
      await prisma.user.create({
        data: {
          name: "Delete staff",
          email: `delete-staff-${suffix}@test.com`,
          role: "STAFF",
        },
      })
    ).id;
  });
  afterAll(async () => {
    // Cleanup only IDs created by this suite, even when an assertion fails.
    const purchases = await prisma.purchase.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const purchaseIds = purchases.map((p) => p.id);
    const lines = await prisma.purchaseItem.findMany({
      where: { purchaseId: { in: purchaseIds } },
      select: { id: true },
    });
    const inventoryWhere = {
      OR: [
        { id: { in: ids } },
        { itemId: { in: ids } },
        { purchaseItemId: { in: lines.map((l) => l.id) } },
      ],
    };
    await prisma.inventoryMovement.deleteMany({
      where: { ...inventoryWhere, reversalOfId: { not: null } },
    });
    await prisma.inventoryMovement.deleteMany({ where: inventoryWhere });
    await prisma.financialEntry.deleteMany({
      where: {
        OR: [
          { id: { in: ids } },
          { purchaseId: { in: purchaseIds } },
          { reversalOf: { purchaseId: { in: purchaseIds } } },
        ],
        reversalOfId: { not: null },
      },
    });
    await prisma.financialEntry.deleteMany({
      where: { OR: [{ id: { in: ids } }, { purchaseId: { in: purchaseIds } }] },
    });
    await prisma.purchaseItem.deleteMany({
      where: { purchaseId: { in: purchaseIds } },
    });
    await prisma.purchase.deleteMany({ where: { id: { in: ids } } });
    await prisma.jobMaterialConsumption.deleteMany({
      where: { id: { in: ids }, replacesId: { not: null } },
    });
    await prisma.jobMaterialConsumption.deleteMany({
      where: { id: { in: ids } },
    });
    await prisma.job.deleteMany({ where: { id: { in: ids } } });
    await prisma.appointment.deleteMany({ where: { id: { in: ids } } });
    await prisma.serviceCaseAmountRevision.deleteMany({
      where: { serviceCaseId: { in: ids } },
    });
    await prisma.serviceCase.deleteMany({ where: { id: { in: ids } } });
    await prisma.quote.deleteMany({ where: { id: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: ids } } });
    await prisma.client.deleteMany({ where: { id: { in: ids } } });
    await prisma.serviceVariant.deleteMany({
      where: { serviceId: { in: ids } },
    });
    await prisma.service.deleteMany({ where: { id: { in: ids } } });
    await prisma.serviceCategory.deleteMany({ where: { id: { in: ids } } });
    await prisma.purchasePresentation.deleteMany({
      where: { itemId: { in: ids } },
    });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: ids } } });
    await prisma.inventoryCategory.deleteMany({ where: { id: { in: ids } } });
    await prisma.supplier.deleteMany({ where: { id: { in: ids } } });
    await prisma.idempotencyKey.deleteMany({ where: { actorId: admin } });
    await prisma.user.deleteMany({ where: { id: { in: [admin, staff] } } });
  });

  it("blocks staff and newly disabled administrators at the mutation boundary", async () => {
    const client = keep(
      await prisma.client.create({ data: { displayName: suffix } }),
    );
    await expect(deleteRecord("client", client.id, staff)).rejects.toThrow(
      "administrador activo",
    );
    await prisma.user.update({ where: { id: admin }, data: { active: false } });
    try {
      await expect(erase("client", client.id)).rejects.toThrow(
        "administrador activo",
      );
    } finally {
      await prisma.user.update({
        where: { id: admin },
        data: { active: true },
      });
    }
    expect(
      await prisma.client.findUnique({ where: { id: client.id } }),
    ).not.toBeNull();
    await erase("client", client.id);
    expect(
      await prisma.client.findUnique({ where: { id: client.id } }),
    ).toBeNull();
  });

  it("blocks dependencies with navigable links and deletes actual rows in dependency order", async () => {
    const { client, vehicle, serviceCase } = await clientGraph();
    await expect(erase("client", client.id)).rejects.toMatchObject({
      dependencies: expect.arrayContaining([
        expect.objectContaining({
          label: "vehículo",
          count: 1,
          href: expect.stringContaining(client.id),
        }),
      ]),
    });
    await expect(erase("vehicle", vehicle.id)).rejects.toThrow("asociados");
    await erase("serviceCase", serviceCase.id);
    await erase("vehicle", vehicle.id);
    await erase("client", client.id);
    expect(await prisma.client.count({ where: { id: client.id } })).toBe(0);
  });

  it("finds every module and includes archived records without exposing arbitrary tables", async () => {
    for (const kind of recordKinds)
      await expect(
        listDeletionRecords(kind, suffix, 1),
      ).resolves.toBeInstanceOf(Array);
    const client = keep(
      await prisma.client.create({
        data: { displayName: suffix, active: false, archivedAt: new Date() },
      }),
    );
    expect(await listDeletionRecords("client", client.id, 1)).toEqual([
      expect.objectContaining({ id: client.id }),
    ]);
    expect(await listDeletionRecords("client", "' OR 1=1 --", 1)).toEqual([]);
    await erase("client", client.id);
  });

  it("keeps service associations intact instead of silently nulling snapshot references", async () => {
    const { serviceCase } = await clientGraph();
    const category = keep(
      await prisma.serviceCategory.create({ data: { name: randomUUID() } }),
    );
    const service = keep(
      await prisma.service.create({
        data: { name: suffix, categoryId: category.id },
      }),
    );
    const appointment = keep(
      await prisma.appointment.create({
        data: {
          serviceCaseId: serviceCase.id,
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
          services: { create: { serviceId: service.id, nameSnapshot: suffix } },
        },
      }),
    );
    await expect(erase("service", service.id)).rejects.toThrow("asociados");
    await expect(erase("serviceCategory", category.id)).rejects.toThrow(
      "asociados",
    );
    expect(
      (
        await prisma.appointmentService.findFirstOrThrow({
          where: { appointmentId: appointment.id },
        })
      ).serviceId,
    ).toBe(service.id);
    await erase("appointment", appointment.id);
    await erase("service", service.id);
    await erase("serviceCategory", category.id);
  });

  it("removes posted purchases with their ledger and stock, preventing idempotency ghost IDs", async () => {
    const { item, supplier } = await stockGraph();
    const row = await purchase(item.id, supplier.id);
    const cash = await prisma.financialEntry.findUniqueOrThrow({
      where: { purchaseId: row.id },
    });
    await expect(erase("financialEntry", cash.id)).rejects.toThrow("completo");
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { itemId: item.id },
    });
    await expect(erase("inventoryMovement", movement.id)).rejects.toThrow(
      "completo",
    );
    await erase("purchase", row.id);
    expect(
      await prisma.purchase.findUnique({ where: { id: row.id } }),
    ).toBeNull();
    expect(
      await prisma.purchaseItem.count({ where: { purchaseId: row.id } }),
    ).toBe(0);
    expect(
      await prisma.financialEntry.findUnique({ where: { id: cash.id } }),
    ).toBeNull();
    expect(
      await prisma.inventoryMovement.count({ where: { itemId: item.id } }),
    ).toBe(0);
    expect((await reconcileInventory(item.id))[0]?.matches).toBe(true);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
      ).currentStock.toString(),
    ).toBe("0");
    expect(
      await prisma.idempotencyKey.count({ where: { resultReference: row.id } }),
    ).toBe(0);
  });

  it("rolls back a whole purchase deletion if its stock was consumed, then allows deletion after removing the output", async () => {
    const { item, supplier } = await stockGraph();
    const row = await purchase(item.id, supplier.id);
    const output = await adjustment(item.id, -3);
    await expect(erase("purchase", row.id)).rejects.toThrow("negativo");
    expect(await prisma.purchase.count({ where: { id: row.id } })).toBe(1);
    expect(
      await prisma.financialEntry.count({ where: { purchaseId: row.id } }),
    ).toBe(1);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
      ).currentStock.toString(),
    ).toBe("7");
    await erase("inventoryMovement", output.id);
    await erase("purchase", row.id);
    expect((await reconcileInventory(item.id))[0]?.matches).toBe(true);
  });

  it("deletes a voided purchase and both compensations without applying stock twice", async () => {
    const { item, supplier } = await stockGraph();
    const row = await purchase(item.id, supplier.id);
    await voidPurchase(
      { purchaseId: row.id, reason: "Prueba de borrado" },
      { id: admin },
    );
    const reversal = await prisma.inventoryMovement.findFirstOrThrow({
      where: { itemId: item.id, type: "REVERSAL" },
    });
    await expect(erase("inventoryMovement", reversal.id)).rejects.toThrow(
      "completo",
    );
    await erase("purchase", row.id);
    expect(
      await prisma.inventoryMovement.count({ where: { itemId: item.id } }),
    ).toBe(0);
    expect((await reconcileInventory(item.id))[0]?.matches).toBe(true);
  });

  it("prevents deleting a completed appointment before its job and reopens it after job deletion", async () => {
    const { serviceCase } = await clientGraph();
    const appointment = keep(
      await prisma.appointment.create({
        data: {
          serviceCaseId: serviceCase.id,
          status: "COMPLETED",
          startAt: new Date(),
          endAt: new Date(Date.now() + 3600000),
        },
      }),
    );
    const job = keep(
      await prisma.job.create({
        data: {
          serviceCaseId: serviceCase.id,
          originAppointmentId: appointment.id,
          performedAt: new Date(),
        },
      }),
    );
    await expect(erase("appointment", appointment.id)).rejects.toThrow(
      "asociados",
    );
    await erase("job", job.id);
    expect(
      (
        await prisma.appointment.findUniqueOrThrow({
          where: { id: appointment.id },
        })
      ).status,
    ).toBe("CONFIRMED");
    await erase("appointment", appointment.id);
  });

  it("removes consumption postings before the job and restores inventory exactly once", async () => {
    const { serviceCase } = await clientGraph();
    const { item } = await stockGraph();
    await adjustment(item.id, 10);
    const job = keep(
      await prisma.job.create({
        data: { serviceCaseId: serviceCase.id, performedAt: new Date() },
      }),
    );
    const consumption = keep(
      await prisma.jobMaterialConsumption.create({
        data: {
          jobId: job.id,
          itemId: item.id,
          quantityBase: 3,
          unitSnapshot: "meter",
        },
      }),
    );
    await prisma.inventoryMovement.create({
      data: {
        itemId: item.id,
        consumptionId: consumption.id,
        type: "CONSUMPTION",
        signedQuantityBase: -3,
        unitSnapshot: "meter",
        note: "Uso",
        occurredAt: new Date(),
      },
    });
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { currentStock: 7 },
    });
    await expect(erase("job", job.id)).rejects.toThrow("asociados");
    await erase("consumption", consumption.id);
    await erase("job", job.id);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
      ).currentStock.toString(),
    ).toBe("10");
    expect((await reconcileInventory(item.id))[0]?.matches).toBe(true);
  });
  it("blocks accepted quote deletion until its case is empty, then restores a valid issued quote", async () => {
    const { client, vehicle } = await clientGraph();
    const quote = keep(
      await prisma.quote.create({
        data: {
          clientId: client.id,
          vehicleId: vehicle.id,
          number: randomUUID(),
          status: "SENT",
          issuedOn: new Date(),
          sentAt: new Date(),
          subtotalUsd: 50,
          totalUsd: 50,
          sourceSubtotal: 50,
          sourceDiscount: 0,
          sourceTotal: 50,
        },
      }),
    );
    const accepted = await acceptQuote(quote.id, { id: admin });
    ids.push(accepted.id);
    await expect(erase("quote", quote.id)).rejects.toThrow("asociados");
    await erase("serviceCase", accepted.id);
    expect(
      await prisma.quote.findUnique({ where: { id: quote.id } }),
    ).toMatchObject({ status: "SENT", acceptedAt: null });
    const again = await acceptQuote(quote.id, { id: admin });
    ids.push(again.id);
    expect(again.id).not.toBe(accepted.id);
    await erase("serviceCase", again.id);
    await erase("quote", quote.id);
  });

  it("removes reversals before original manual payments and updates case balances", async () => {
    const { serviceCase } = await clientGraph();
    const entry = keep(
      await prisma.financialEntry.create({
        data: {
          serviceCaseId: serviceCase.id,
          direction: "INFLOW",
          type: "CUSTOMER_PAYMENT",
          amountUsd: 20,
          sourceAmount: 20,
          occurredAt: new Date(),
        },
      }),
    );
    const reversal = keep(
      await prisma.financialEntry.create({
        data: {
          serviceCaseId: serviceCase.id,
          direction: "OUTFLOW",
          type: "REVERSAL",
          reversalOfId: entry.id,
          amountUsd: 20,
          sourceAmount: 20,
          occurredAt: new Date(),
        },
      }),
    );
    await expect(erase("financialEntry", entry.id)).rejects.toThrow(
      "asociados",
    );
    await erase("financialEntry", reversal.id);
    await erase("financialEntry", entry.id);
    expect(
      await prisma.financialEntry.count({
        where: { serviceCaseId: serviceCase.id },
      }),
    ).toBe(0);
  });

  it("commits photo deletion and durably retries private file cleanup when storage is unavailable", async () => {
    const { serviceCase } = await clientGraph();
    const job = keep(
      await prisma.job.create({
        data: { serviceCaseId: serviceCase.id, performedAt: new Date() },
      }),
    );
    const objectKey = `jobs/${job.id}/${randomUUID()}.jpg`;
    const intent = await prisma.photoUploadIntent.create({
      data: {
        jobId: job.id,
        objectKey,
        expectedMime: "image/jpeg",
        expectedSize: 100,
        uploadTokenHash: suffix,
        expiresAt: new Date(),
        confirmedAt: new Date(),
      },
    });
    const photo = await prisma.jobPhoto.create({
      data: {
        jobId: job.id,
        uploadIntentId: intent.id,
        originalKey: objectKey,
        previewKey: objectKey + ".preview",
        thumbnailKey: objectKey + ".thumb",
        mimeType: "image/jpeg",
        width: 10,
        height: 10,
        sizeBytes: 100,
        deletedAt: new Date(),
      },
    });
    const storage = vi
      .spyOn(privateStorage, "deletePrivateObject")
      .mockRejectedValue(new Error("Storage unavailable"));
    try {
      await erase("photo", photo.id);
      expect(
        await prisma.jobPhoto.findUnique({ where: { id: photo.id } }),
      ).toBeNull();
      expect(
        await prisma.photoUploadIntent.findUnique({ where: { id: intent.id } }),
      ).toBeNull();
      expect(
        await prisma.pendingStorageDeletion.count({
          where: { objectKey: { startsWith: objectKey } },
        }),
      ).toBe(3);
      storage.mockResolvedValue(undefined);
      await cleanupDeletedRecordFiles();
      expect(
        await prisma.pendingStorageDeletion.count({
          where: { objectKey: { startsWith: objectKey } },
        }),
      ).toBe(0);
    } finally {
      storage.mockRestore();
    }
    await erase("job", job.id);
  });

  it("does not apply stock removal twice under concurrent requests", async () => {
    const { item, supplier } = await stockGraph();
    const row = await purchase(item.id, supplier.id);
    const results = await Promise.allSettled([
      erase("purchase", row.id),
      erase("purchase", row.id),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
      ).currentStock.toString(),
    ).toBe("0");
    expect((await reconcileInventory(item.id))[0]?.matches).toBe(true);
  });
  it("deletes corrected consumptions newest first without reviving the reversed predecessor", async () => {
    const { serviceCase } = await clientGraph();
    const { item } = await stockGraph();
    await adjustment(item.id, 10);
    const job = keep(
      await prisma.job.create({
        data: { serviceCaseId: serviceCase.id, performedAt: new Date() },
      }),
    );
    const original = keep(
      await addJobConsumption(
        {
          jobId: job.id,
          itemId: item.id,
          quantityBase: "3",
          idempotencyKey: randomUUID(),
        },
        { id: admin },
      ),
    );
    const corrected = keep(
      await correctJobConsumption(
        {
          consumptionId: original.id,
          quantityBase: "4",
          reason: "Corregir material",
          idempotencyKey: randomUUID(),
        },
        { id: admin },
      ),
    );
    await expect(erase("consumption", original.id)).rejects.toThrow(
      "asociados",
    );
    await erase("consumption", corrected.id);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
      ).currentStock.toString(),
    ).toBe("10");
    await erase("consumption", original.id);
    expect(
      (
        await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } })
      ).currentStock.toString(),
    ).toBe("10");
    expect((await reconcileInventory(item.id))[0]?.matches).toBe(true);
    await erase("job", job.id);
  });
});
