-- CreateEnum
CREATE TYPE "FinancialDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "FinancialEntryType" AS ENUM ('CUSTOMER_PAYMENT', 'CUSTOMER_REFUND', 'PURCHASE', 'MANUAL_INCOME', 'MANUAL_EXPENSE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('TRANSFER', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "service_case_amount_revisions" (
    "id" UUID NOT NULL,
    "serviceCaseId" UUID NOT NULL,
    "previousAmountUsd" DECIMAL(19,2),
    "newAmountUsd" DECIMAL(19,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "service_case_amount_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_case_amount_revisions_amounts_nonnegative" CHECK (("previousAmountUsd" IS NULL OR "previousAmountUsd" >= 0) AND "newAmountUsd" >= 0),
    CONSTRAINT "service_case_amount_revisions_reason_not_blank" CHECK (length(trim("reason")) > 0)
);

-- CreateTable
CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "direction" "FinancialDirection" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_categories_name_not_blank" CHECK (length(trim("name")) > 0),
    CONSTRAINT "financial_categories_sort_nonnegative" CHECK ("sortOrder" >= 0)
);

-- CreateTable
CREATE TABLE "financial_entries" (
    "id" UUID NOT NULL,
    "direction" "FinancialDirection" NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "amountUsd" DECIMAL(19,2) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "description" TEXT,
    "paymentMethod" "PaymentMethod",
    "serviceCaseId" UUID,
    "categoryId" UUID,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_entries_amount_positive" CHECK ("amountUsd" > 0),
    CONSTRAINT "financial_entries_customer_case" CHECK (
      ("type" NOT IN ('CUSTOMER_PAYMENT', 'CUSTOMER_REFUND')) OR "serviceCaseId" IS NOT NULL
    ),
    CONSTRAINT "financial_entries_direction_matches_type" CHECK (
      ("type" NOT IN ('CUSTOMER_PAYMENT', 'MANUAL_INCOME') OR "direction" = 'INFLOW') AND
      ("type" NOT IN ('CUSTOMER_REFUND', 'PURCHASE', 'MANUAL_EXPENSE') OR "direction" = 'OUTFLOW')
    ),
    CONSTRAINT "financial_entries_manual_category" CHECK (
      ("type" NOT IN ('MANUAL_INCOME', 'MANUAL_EXPENSE')) OR "categoryId" IS NOT NULL
    ),
    CONSTRAINT "financial_entries_reversal_link" CHECK (
      ("type" = 'REVERSAL' AND "reversalOfId" IS NOT NULL) OR
      ("type" <> 'REVERSAL' AND "reversalOfId" IS NULL)
    )
);

-- Preserve the origin of agreed amounts that existed before the finance ledger.
INSERT INTO "service_case_amount_revisions" (
  "id", "serviceCaseId", "previousAmountUsd", "newAmountUsd", "reason", "createdAt", "createdById"
)
SELECT
  gen_random_uuid(), "id", NULL, "agreedAmountUsd", 'Importe inicial previo al ledger financiero', "createdAt", "createdById"
FROM "service_cases"
WHERE "agreedAmountUsd" IS NOT NULL;

-- CreateIndex
CREATE INDEX "service_case_amount_revisions_serviceCaseId_createdAt_idx" ON "service_case_amount_revisions"("serviceCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "financial_categories_active_direction_sortOrder_idx" ON "financial_categories"("active", "direction", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "financial_categories_direction_name_key" ON "financial_categories"("direction", "name");

-- CreateIndex
CREATE UNIQUE INDEX "financial_entries_reversalOfId_key" ON "financial_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "financial_entries_occurredAt_direction_idx" ON "financial_entries"("occurredAt", "direction");

-- CreateIndex
CREATE INDEX "financial_entries_serviceCaseId_occurredAt_idx" ON "financial_entries"("serviceCaseId", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_entries_categoryId_occurredAt_idx" ON "financial_entries"("categoryId", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_entries_type_occurredAt_idx" ON "financial_entries"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "service_case_amount_revisions" ADD CONSTRAINT "service_case_amount_revisions_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "service_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case_amount_revisions" ADD CONSTRAINT "service_case_amount_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "service_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "financial_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "financial_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
