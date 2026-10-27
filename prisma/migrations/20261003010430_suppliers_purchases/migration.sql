CREATE TYPE "PurchaseStatus" AS ENUM ('POSTED', 'VOIDED');

ALTER TABLE "financial_entries" ADD COLUMN "purchaseId" UUID;
ALTER TABLE "inventory_movements" ADD COLUMN "purchaseItemId" UUID;

CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "suppliers_name_nonblank" CHECK (btrim("name") <> '')
);

CREATE TABLE "purchase_sequences" (
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "purchase_sequences_pkey" PRIMARY KEY ("year"),
    CONSTRAINT "purchase_sequences_value_positive" CHECK ("nextValue" > 0)
);

CREATE TABLE "purchases" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "totalUsd" DECIMAL(19,2) NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'POSTED',
    "postedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "voidedById" UUID,
    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchases_total_positive" CHECK ("totalUsd" > 0),
    CONSTRAINT "purchases_void_state" CHECK (
      ("status" = 'POSTED' AND "voidedAt" IS NULL AND "voidReason" IS NULL AND "voidedById" IS NULL)
      OR ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND btrim("voidReason") <> '')
    )
);

CREATE TABLE "purchase_items" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "presentationId" UUID,
    "itemNameSnapshot" TEXT NOT NULL,
    "presentationNameSnapshot" TEXT NOT NULL,
    "baseUnitSnapshot" TEXT NOT NULL,
    "factorToBaseSnapshot" DECIMAL(19,6) NOT NULL,
    "quantityPurchased" DECIMAL(19,3) NOT NULL,
    "quantityBase" DECIMAL(19,3) NOT NULL,
    "unitCostUsd" DECIMAL(19,2) NOT NULL,
    "totalUsd" DECIMAL(19,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_items_snapshots_nonblank" CHECK (
      btrim("itemNameSnapshot") <> '' AND btrim("presentationNameSnapshot") <> '' AND btrim("baseUnitSnapshot") <> ''
    ),
    CONSTRAINT "purchase_items_values_positive" CHECK (
      "factorToBaseSnapshot" > 0 AND "quantityPurchased" > 0 AND "quantityBase" > 0 AND "unitCostUsd" > 0 AND "totalUsd" > 0
    )
);

CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");
CREATE INDEX "suppliers_active_name_idx" ON "suppliers"("active", "name");
CREATE UNIQUE INDEX "purchases_number_key" ON "purchases"("number");
CREATE INDEX "purchases_businessDate_status_idx" ON "purchases"("businessDate", "status");
CREATE INDEX "purchases_supplierId_businessDate_idx" ON "purchases"("supplierId", "businessDate");
CREATE INDEX "purchase_items_purchaseId_sortOrder_idx" ON "purchase_items"("purchaseId", "sortOrder");
CREATE INDEX "purchase_items_itemId_idx" ON "purchase_items"("itemId");
CREATE UNIQUE INDEX "financial_entries_purchaseId_key" ON "financial_entries"("purchaseId");
CREATE UNIQUE INDEX "inventory_movements_purchaseItemId_key" ON "inventory_movements"("purchaseItemId");

ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "purchase_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "purchase_presentations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
