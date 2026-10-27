ALTER TABLE "inventory_movements" ADD COLUMN "consumptionId" UUID;

CREATE TABLE "job_material_consumptions" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantityBase" DECIMAL(19,3) NOT NULL,
    "unitSnapshot" TEXT NOT NULL,
    "note" TEXT,
    "replacesId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    CONSTRAINT "job_material_consumptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_material_consumptions_quantity_positive" CHECK ("quantityBase" > 0),
    CONSTRAINT "job_material_consumptions_unit_nonblank" CHECK (btrim("unitSnapshot") <> ''),
    CONSTRAINT "job_material_consumptions_no_self_replace" CHECK ("replacesId" IS NULL OR "replacesId" <> "id")
);

CREATE UNIQUE INDEX "job_material_consumptions_replacesId_key" ON "job_material_consumptions"("replacesId");
CREATE INDEX "job_material_consumptions_jobId_createdAt_idx" ON "job_material_consumptions"("jobId", "createdAt");
CREATE INDEX "job_material_consumptions_itemId_createdAt_idx" ON "job_material_consumptions"("itemId", "createdAt");
CREATE UNIQUE INDEX "inventory_movements_consumptionId_key" ON "inventory_movements"("consumptionId");

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "job_material_consumptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_material_consumptions" ADD CONSTRAINT "job_material_consumptions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_material_consumptions" ADD CONSTRAINT "job_material_consumptions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_material_consumptions" ADD CONSTRAINT "job_material_consumptions_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "job_material_consumptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_material_consumptions" ADD CONSTRAINT "job_material_consumptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
