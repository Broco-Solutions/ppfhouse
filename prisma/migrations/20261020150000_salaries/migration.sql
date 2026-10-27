-- CreateEnum
CREATE TYPE "SalaryMonthStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "FinancialEntryType" ADD VALUE 'SALARY_PAYMENT';

-- AlterTable
ALTER TABLE "financial_entries" ADD COLUMN     "salaryMonthId" UUID;

-- CreateTable
CREATE TABLE "salaries" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startMonth" VARCHAR(7) NOT NULL,
    "endMonth" VARCHAR(7),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_rates" (
    "id" UUID NOT NULL,
    "salaryId" UUID NOT NULL,
    "effectiveMonth" VARCHAR(7) NOT NULL,
    "amountArs" DECIMAL(19,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salary_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_months" (
    "id" UUID NOT NULL,
    "salaryId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "amountArs" DECIMAL(19,2) NOT NULL,
    "status" "SalaryMonthStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "paymentEntryId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salary_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_events" (
    "id" UUID NOT NULL,
    "salaryId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "salary_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_rates_salaryId_effectiveMonth_key" ON "salary_rates"("salaryId", "effectiveMonth");

-- CreateIndex
CREATE UNIQUE INDEX "salary_months_paymentEntryId_key" ON "salary_months"("paymentEntryId");

-- CreateIndex
CREATE INDEX "salary_months_status_month_idx" ON "salary_months"("status", "month");

-- CreateIndex
CREATE UNIQUE INDEX "salary_months_salaryId_month_key" ON "salary_months"("salaryId", "month");

-- CreateIndex
CREATE INDEX "salary_events_salaryId_createdAt_idx" ON "salary_events"("salaryId", "createdAt");

-- AddForeignKey
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_salaryMonthId_fkey" FOREIGN KEY ("salaryMonthId") REFERENCES "salary_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_rates" ADD CONSTRAINT "salary_rates_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_months" ADD CONSTRAINT "salary_months_paymentEntryId_fkey" FOREIGN KEY ("paymentEntryId") REFERENCES "financial_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_months" ADD CONSTRAINT "salary_months_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_events" ADD CONSTRAINT "salary_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_events" ADD CONSTRAINT "salary_events_salaryId_fkey" FOREIGN KEY ("salaryId") REFERENCES "salaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep money, monthly identity and active payment state consistent at the DB boundary.
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_months_check" CHECK (
  "startMonth" ~ '^[2-9][0-9]{3}-(0[1-9]|1[0-2])$' AND
  ("endMonth" IS NULL OR ("endMonth" ~ '^[2-9][0-9]{3}-(0[1-9]|1[0-2])$' AND "endMonth" >= "startMonth"))
);
ALTER TABLE "salary_rates" ADD CONSTRAINT "salary_rates_amount_check" CHECK ("amountArs" > 0);
ALTER TABLE "salary_rates" ADD CONSTRAINT "salary_rates_month_check" CHECK ("effectiveMonth" ~ '^[2-9][0-9]{3}-(0[1-9]|1[0-2])$');
ALTER TABLE "salary_months" ADD CONSTRAINT "salary_months_amount_check" CHECK ("amountArs" > 0);
ALTER TABLE "salary_months" ADD CONSTRAINT "salary_months_month_check" CHECK ("month" ~ '^[2-9][0-9]{3}-(0[1-9]|1[0-2])$');
ALTER TABLE "salary_months" ADD CONSTRAINT "salary_months_payment_check" CHECK (("status" = 'PAID') = ("paymentEntryId" IS NOT NULL));
-- Cast to text so this additive migration can introduce the enum value in the same transaction.
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_salary_check" CHECK (
  ("type"::text <> 'SALARY_PAYMENT' OR ("direction" = 'OUTFLOW' AND "sourceCurrency" = 'ARS' AND "salaryMonthId" IS NOT NULL AND "serviceCaseId" IS NULL)) AND
  ("salaryMonthId" IS NULL OR "type"::text IN ('SALARY_PAYMENT', 'REVERSAL'))
);
CREATE INDEX "financial_entries_salaryMonthId_idx" ON "financial_entries"("salaryMonthId");
