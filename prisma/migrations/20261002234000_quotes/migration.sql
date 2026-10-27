CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

ALTER TABLE "service_cases" ADD COLUMN "acceptedQuoteId" UUID;

CREATE TABLE "quote_sequences" (
  "year" INTEGER NOT NULL,
  "nextValue" INTEGER NOT NULL,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "quote_sequences_pkey" PRIMARY KEY ("year"),
  CONSTRAINT "quote_sequences_next_positive" CHECK ("nextValue" > 0)
);

CREATE TABLE "quotes" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedOn" DATE NOT NULL,
  "validUntil" DATE,
  "notes" TEXT,
  "terms" TEXT,
  "subtotalUsd" DECIMAL(19,2) NOT NULL,
  "discountUsd" DECIMAL(19,2) NOT NULL DEFAULT 0,
  "totalUsd" DECIMAL(19,2) NOT NULL,
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "pdfArtifactKey" TEXT,
  "pdfSha256" TEXT,
  "pdfGeneratedAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "acceptedAt" TIMESTAMPTZ(3),
  "rejectedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdById" UUID,
  "updatedById" UUID,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotes_totals_nonnegative" CHECK ("subtotalUsd" >= 0 AND "discountUsd" >= 0 AND "totalUsd" >= 0),
  CONSTRAINT "quotes_total_consistent" CHECK ("totalUsd" = "subtotalUsd" - "discountUsd"),
  CONSTRAINT "quotes_discount_not_excessive" CHECK ("discountUsd" <= "subtotalUsd"),
  CONSTRAINT "quotes_validity_order" CHECK ("validUntil" IS NULL OR "validUntil" >= "issuedOn"),
  CONSTRAINT "quotes_template_positive" CHECK ("templateVersion" > 0),
  CONSTRAINT "quotes_pdf_fields_consistent" CHECK (("pdfArtifactKey" IS NULL AND "pdfSha256" IS NULL AND "pdfGeneratedAt" IS NULL) OR ("pdfArtifactKey" IS NOT NULL AND "pdfSha256" IS NOT NULL AND "pdfGeneratedAt" IS NOT NULL))
);

CREATE TABLE "quote_items" (
  "id" UUID NOT NULL,
  "quoteId" UUID NOT NULL,
  "serviceId" UUID,
  "nameSnapshot" TEXT NOT NULL,
  "descriptionSnapshot" TEXT,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPriceUsd" DECIMAL(19,2) NOT NULL,
  "discountUsd" DECIMAL(19,2) NOT NULL DEFAULT 0,
  "totalUsd" DECIMAL(19,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quote_items_name_not_blank" CHECK (length(trim("nameSnapshot")) > 0),
  CONSTRAINT "quote_items_values_valid" CHECK ("quantity" > 0 AND "unitPriceUsd" >= 0 AND "discountUsd" >= 0 AND "totalUsd" >= 0 AND "sortOrder" >= 0)
);

CREATE UNIQUE INDEX "quotes_number_key" ON "quotes"("number");
CREATE INDEX "quotes_status_issuedOn_idx" ON "quotes"("status", "issuedOn");
CREATE INDEX "quotes_clientId_issuedOn_idx" ON "quotes"("clientId", "issuedOn");
CREATE INDEX "quotes_vehicleId_idx" ON "quotes"("vehicleId");
CREATE INDEX "quote_items_quoteId_sortOrder_idx" ON "quote_items"("quoteId", "sortOrder");
CREATE INDEX "quote_items_serviceId_idx" ON "quote_items"("serviceId");
CREATE UNIQUE INDEX "service_cases_acceptedQuoteId_key" ON "service_cases"("acceptedQuoteId");

ALTER TABLE "service_cases" ADD CONSTRAINT "service_cases_acceptedQuoteId_fkey" FOREIGN KEY ("acceptedQuoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
