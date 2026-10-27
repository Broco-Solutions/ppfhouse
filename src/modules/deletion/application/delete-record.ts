import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/db/client";
import { logger } from "@/infrastructure/logging/logger";
import {
  recordKinds,
  recordLabels,
  recordManagerPath,
  type RecordKind,
  type DeletionDependency,
} from "../domain/records";
import { table } from "./record-config";
import { cleanupDeletedRecordFiles } from "./storage-cleanup";
import { z } from "zod";

type Tx = Prisma.TransactionClient;
export class DeletionError extends Error {
  constructor(
    message: string,
    public dependencies: DeletionDependency[] = [],
  ) {
    super(message);
  }
}
type Relation = readonly [RecordKind, string, string?];
const dependencies: Partial<Record<RecordKind, readonly Relation[]>> = {
  client: [
    ["vehicle", "clientId"],
    ["serviceCase", "clientId"],
    ["quote", "clientId"],
  ],
  vehicle: [
    ["serviceCase", "vehicleId"],
    ["quote", "vehicleId"],
  ],
  serviceCategory: [["service", "categoryId"]],
  quote: [["serviceCase", "acceptedQuoteId"]],
  appointment: [["job", "originAppointmentId"]],
  serviceCase: [
    ["appointment", "serviceCaseId"],
    ["job", "serviceCaseId"],
    ["financialEntry", "serviceCaseId"],
  ],
  financialCategory: [["financialEntry", "categoryId"]],
  financialEntry: [["financialEntry", "reversalOfId", "reversión financiera"]],
  inventoryCategory: [["inventoryItem", "categoryId"]],
  inventoryItem: [
    ["inventoryMovement", "itemId"],
    ["consumption", "itemId"],
  ],
  inventoryMovement: [
    ["inventoryMovement", "reversalOfId", "reversión de inventario"],
  ],
  supplier: [["purchase", "supplierId"]],
  job: [["consumption", "jobId"]],
  consumption: [["consumption", "replacesId", "corrección de consumo"]],
};
async function checkDependencies(tx: Tx, kind: RecordKind, id: string) {
  const found: DeletionDependency[] = [];
  for (const [child, field, label] of dependencies[kind] ?? []) {
    const counts = await tx.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT count(*) AS count FROM ${table(child)} WHERE ${Prisma.raw(`"${field}"`)}=${id}::uuid`,
    );
    const count = counts[0]?.count ?? 0n;
    if (count > 0n)
      found.push({
        label: label ?? recordLabels[child],
        count: Number(count),
        href: `${recordManagerPath(child)}&q=${id}`,
      });
  }
  if (kind === "service") {
    const counts = await Promise.all([
      tx.appointmentService.count({ where: { serviceId: id } }),
      tx.jobService.count({ where: { serviceId: id } }),
      tx.quoteItem.count({ where: { serviceId: id } }),
    ]);
    for (const [index, child] of (
      ["appointment", "job", "quote"] as const
    ).entries()) {
      if (counts[index])
        found.push({
          label: recordLabels[child],
          count: counts[index],
          href: recordManagerPath(child),
        });
    }
  }
  if (kind === "inventoryItem" || kind === "purchasePresentation") {
    const count = await tx.purchaseItem.count({
      where: kind === "inventoryItem" ? { itemId: id } : { presentationId: id },
    });
    if (count)
      found.push({
        label: "ítem de compra",
        count,
        href: recordManagerPath("purchase"),
      });
  }
  if (found.length)
    throw new DeletionError(
      "No se puede eliminar: primero eliminá los registros asociados.",
      found,
    );
}
function blockedBy(kind: RecordKind, id: string) {
  throw new DeletionError(
    `Este movimiento pertenece a un ${recordLabels[kind]}. Eliminá ese registro completo para mantener los saldos correctos.`,
    [
      {
        label: recordLabels[kind],
        count: 1,
        href: `${recordManagerPath(kind)}&q=${id}`,
      },
    ],
  );
}
async function queueFiles(tx: Tx, keys: (string | null | undefined)[]) {
  const unique = [...new Set(keys.filter((key): key is string => !!key))];
  if (unique.length)
    await tx.pendingStorageDeletion.createMany({
      data: unique.map((objectKey) => ({ objectKey })),
      skipDuplicates: true,
    });
}
async function removePhotos(tx: Tx, where: { jobId: string } | { id: string }) {
  const photos = await tx.jobPhoto.findMany({ where });
  const intents = await tx.photoUploadIntent.findMany({
    where:
      "jobId" in where
        ? { jobId: where.jobId }
        : { id: { in: photos.map((p) => p.uploadIntentId) } },
  });
  const keys = [
    ...photos.flatMap((p) => [p.originalKey, p.previewKey, p.thumbnailKey]),
    ...intents.map((i) => i.objectKey),
  ];
  await queueFiles(tx, keys);
  await tx.vehicle.updateMany({
    where: { coverObjectKey: { in: keys } },
    data: { coverObjectKey: null },
  });
  await tx.jobPhoto.deleteMany({ where });
  await tx.photoUploadIntent.deleteMany({
    where: { id: { in: intents.map((i) => i.id) } },
  });
}
// Remove complete posting groups together, including reversals. Decimal arithmetic
// and locked item rows keep the materialized stock equal to the remaining ledger.
async function removeInventoryPostings(
  tx: Tx,
  where: Prisma.InventoryMovementWhereInput,
) {
  const originals = await tx.inventoryMovement.findMany({
    where,
    include: { reversedBy: true },
  });
  const rows = originals.flatMap((m) =>
    m.reversedBy ? [m, m.reversedBy] : [m],
  );
  const totals = new Map<string, Prisma.Decimal>();
  for (const row of rows)
    totals.set(
      row.itemId,
      (totals.get(row.itemId) ?? new Prisma.Decimal(0)).plus(
        row.signedQuantityBase,
      ),
    );
  for (const itemId of [...totals.keys()].sort()) {
    await tx.$queryRaw`SELECT id FROM inventory_items WHERE id=${itemId}::uuid FOR UPDATE`;
    const item = await tx.inventoryItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    const next = item.currentStock.minus(totals.get(itemId)!);
    if (next.lt(0) && next.lt(item.currentStock))
      throw new DeletionError(
        `No se puede eliminar: el stock de «${item.name}» quedaría negativo. Eliminá primero los consumos o salidas asociados.`,
      );
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { currentStock: next },
    });
  }
  await tx.inventoryMovement.deleteMany({
    where: { id: { in: rows.filter((r) => r.reversalOfId).map((r) => r.id) } },
  });
  await tx.inventoryMovement.deleteMany({
    where: { id: { in: rows.filter((r) => !r.reversalOfId).map((r) => r.id) } },
  });
  return rows.map((r) => r.id);
}
async function removeFinancialPostings(tx: Tx, purchaseId: string) {
  const entry = await tx.financialEntry.findUnique({
    where: { purchaseId },
    include: { reversedBy: true },
  });
  if (!entry) return [];
  if (entry.reversedBy)
    await tx.financialEntry.delete({ where: { id: entry.reversedBy.id } });
  await tx.financialEntry.delete({ where: { id: entry.id } });
  return [entry.id, ...(entry.reversedBy ? [entry.reversedBy.id] : [])];
}

export async function deleteRecord(
  kindInput: RecordKind,
  idInput: string,
  actorId: string,
) {
  const kind = z.enum(recordKinds).parse(kindInput);
  const id = z.uuid().parse(idInput);
  try {
    await prisma.$transaction(
      async (tx) => {
        // Recheck the persisted user, not a client-supplied role or stale session.
        await tx.$queryRaw`SELECT id FROM users WHERE id=${actorId}::uuid FOR SHARE`;
        const actor = await tx.user.findUnique({ where: { id: actorId } });
        if (!actor?.active || actor.role !== "ADMIN")
          throw new DeletionError(
            "Sólo un administrador activo puede eliminar registros.",
          );
        const rows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM ${table(kind)} WHERE id=${id}::uuid FOR UPDATE`,
        );
        if (!rows.length)
          throw new DeletionError(
            "El registro ya no existe. Actualizá la lista.",
          );
        await checkDependencies(tx, kind, id);
        const erasedIds = [id];
        switch (kind) {
          case "client":
            await tx.clientShareLink.deleteMany({ where: { clientId: id } });
            break;
          case "vehicle":
            await queueFiles(tx, [
              (await tx.vehicle.findUniqueOrThrow({ where: { id } }))
                .coverObjectKey,
            ]);
            break;
          case "service":
            await queueFiles(tx, [
              (await tx.service.findUniqueOrThrow({ where: { id } }))
                .imageObjectKey,
            ]);
            await tx.serviceVariant.deleteMany({ where: { serviceId: id } });
            break;
          case "quote":
            await queueFiles(tx, [
              (await tx.quote.findUniqueOrThrow({ where: { id } }))
                .pdfArtifactKey,
            ]);
            break;
          case "serviceCase": {
            const record = await tx.serviceCase.findUniqueOrThrow({
              where: { id },
            });
            if (record.acceptedQuoteId)
              await tx.quote.update({
                where: { id: record.acceptedQuoteId },
                data: { status: "SENT", acceptedAt: null },
              });
            await tx.serviceCaseAmountRevision.deleteMany({
              where: { serviceCaseId: id },
            });
            break;
          }
          case "job": {
            const job = await tx.job.findUniqueOrThrow({ where: { id } });
            await removePhotos(tx, { jobId: id });
            if (job.originAppointmentId)
              await tx.appointment.updateMany({
                where: { id: job.originAppointmentId, status: "COMPLETED" },
                data: { status: "CONFIRMED" },
              });
            break;
          }
          case "photo":
            await removePhotos(tx, { id });
            break;
          case "inventoryItem":
            await tx.purchasePresentation.deleteMany({ where: { itemId: id } });
            break;
          case "financialEntry": {
            const entry = await tx.financialEntry.findUniqueOrThrow({
              where: { id },
              include: { reversalOf: true },
            });
            const purchaseId = entry.purchaseId ?? entry.reversalOf?.purchaseId;
            if (purchaseId) blockedBy("purchase", purchaseId);
            break;
          }
          case "inventoryMovement": {
            const movement = await tx.inventoryMovement.findUniqueOrThrow({
              where: { id },
              include: { reversalOf: true, purchaseItem: true },
            });
            const origin = movement.reversalOf ?? movement;
            if (origin.purchaseItemId) {
              const line = await tx.purchaseItem.findUniqueOrThrow({
                where: { id: origin.purchaseItemId },
              });
              blockedBy("purchase", line.purchaseId);
            }
            if (origin.consumptionId)
              blockedBy("consumption", origin.consumptionId);
            erasedIds.push(...(await removeInventoryPostings(tx, { id })));
            break;
          }
          case "purchase": {
            erasedIds.push(
              ...(await removeInventoryPostings(tx, {
                purchaseItem: { purchaseId: id },
              })),
            );
            erasedIds.push(...(await removeFinancialPostings(tx, id)));
            await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
            break;
          }
          case "consumption":
            erasedIds.push(
              ...(await removeInventoryPostings(tx, { consumptionId: id })),
            );
            break;
        }
        if (kind !== "photo" && kind !== "inventoryMovement")
          await tx.$executeRaw(
            Prisma.sql`DELETE FROM ${table(kind)} WHERE id=${id}::uuid`,
          );
        // Keep idempotency tombstones, but never replay a deleted result ID.
        await tx.idempotencyKey.updateMany({
          where: { resultReference: { in: erasedIds } },
          data: { resultReference: null },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      },
    );
  } catch (error) {
    if (error instanceof DeletionError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (["P2003", "P2034"].includes(error.code) ||
        (error.code === "P2010" &&
          ["23503", "40001", "40P01"].includes(String(error.meta?.code))))
    )
      throw new DeletionError(
        "El registro tiene dependencias o cambió mientras lo eliminabas. Actualizá la lista y volvé a intentar.",
      );
    throw error;
  }
  logger.info("record_permanently_deleted", { kind, recordId: id, actorId });
  // The durable queue is already committed. Cleanup failure must not imply that
  // the successful database deletion failed or invite duplicate submissions.
  try {
    await cleanupDeletedRecordFiles(10);
  } catch {
    logger.warn("deleted_record_cleanup_deferred", { kind, recordId: id });
  }
}
