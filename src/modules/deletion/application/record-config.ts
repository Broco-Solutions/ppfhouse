import { prisma } from "@/infrastructure/db/client";
import { Prisma } from "@/generated/prisma/client";
import type { RecordKind } from "../domain/records";

// Identifiers and expressions are application constants, never user input.
export const recordTables: Record<RecordKind, string> = {
  client: "clients",
  vehicle: "vehicles",
  appointment: "appointments",
  calendarBlock: "calendar_blocks",
  serviceCategory: "service_categories",
  service: "services",
  serviceVariant: "service_variants",
  quote: "quotes",
  job: "jobs",
  serviceCase: "service_cases",
  financialCategory: "financial_categories",
  financialEntry: "financial_entries",
  inventoryCategory: "inventory_categories",
  inventoryItem: "inventory_items",
  inventoryMovement: "inventory_movements",
  purchasePresentation: "purchase_presentations",
  supplier: "suppliers",
  purchase: "purchases",
  consumption: "job_material_consumptions",
  photo: "job_photos",
};
export function table(kind: RecordKind) {
  return Prisma.raw(`"${recordTables[kind]}"`);
}
const labels: Record<RecordKind, string> = {
  client: 'r."displayName"',
  vehicle: `concat(r.brand, ' ', r.model)`,
  appointment: `(SELECT concat(c."displayName", ' · ', v.brand, ' ', v.model) FROM service_cases s JOIN clients c ON c.id=s."clientId" JOIN vehicles v ON v.id=s."vehicleId" WHERE s.id=r."serviceCaseId")`,
  calendarBlock: "r.reason",
  serviceCategory: "r.name",
  service: "r.name",
  serviceVariant: "r.label",
  quote: "r.number",
  job: `(SELECT concat(c."displayName", ' · ', v.brand, ' ', v.model) FROM service_cases s JOIN clients c ON c.id=s."clientId" JOIN vehicles v ON v.id=s."vehicleId" WHERE s.id=r."serviceCaseId")`,
  serviceCase: `(SELECT concat(c."displayName", ' · ', v.brand, ' ', v.model) FROM clients c JOIN vehicles v ON v.id=r."vehicleId" WHERE c.id=r."clientId")`,
  financialCategory: "r.name",
  financialEntry: `concat(r.type, ' · USD ', r."amountUsd", ' · ', r.description)`,
  inventoryCategory: "r.name",
  inventoryItem: "r.name",
  inventoryMovement: `(SELECT concat(i.name, ' · ', r."signedQuantityBase", ' ', r."unitSnapshot", ' · ', r.note) FROM inventory_items i WHERE i.id=r."itemId")`,
  purchasePresentation: `(SELECT concat(i.name, ' · ', r.name) FROM inventory_items i WHERE i.id=r."itemId")`,
  supplier: "r.name",
  purchase: "r.number",
  consumption: `(SELECT concat(i.name, ' · ', r."quantityBase", ' ', r."unitSnapshot") FROM inventory_items i WHERE i.id=r."itemId")`,
  photo: `concat('Foto · ', r.stage, ' · ', r."createdAt")`,
};
export async function listDeletionRecords(
  kind: RecordKind,
  query: string,
  page: number,
) {
  const eventColumn =
    (
      {
        appointment: 'r."startAt"',
        calendarBlock: 'r."startAt"',
        job: 'r."performedAt"',
        financialEntry: 'r."occurredAt"',
        inventoryMovement: 'r."occurredAt"',
      } as Partial<Record<RecordKind, string>>
    )[kind] ?? "NULL::timestamptz";
  return prisma.$queryRaw<
    {
      id: string;
      label: string;
      createdAt: Date;
      eventAt: Date | null;
      status: string;
    }[]
  >(Prisma.sql`
    SELECT r.id, ${Prisma.raw(labels[kind])} AS label, r."createdAt", ${Prisma.raw(eventColumn)} AS "eventAt",
      COALESCE(to_jsonb(r)->>'status', CASE
        WHEN to_jsonb(r)->>'deletedAt' IS NOT NULL THEN 'Retirado'
        WHEN to_jsonb(r)->>'voidedAt' IS NOT NULL THEN 'Anulado'
        WHEN to_jsonb(r)->>'active' = 'false' THEN 'Inactivo'
        WHEN to_jsonb(r)->>'active' = 'true' THEN 'Activo'
        ELSE '' END) AS status
    FROM ${table(kind)} r
    WHERE (${query} = '' OR to_jsonb(r)::text ILIKE ${`%${query.replace(/[\\%_]/g, "\\$&")}%`})
    ORDER BY r."createdAt" DESC, r.id LIMIT 26 OFFSET ${(page - 1) * 25}
  `);
}
