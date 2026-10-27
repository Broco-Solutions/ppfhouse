CREATE TYPE "SourceCurrency" AS ENUM ('USD', 'ARS');

ALTER TABLE "financial_entries"
  ADD COLUMN "sourceCurrency" "SourceCurrency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "sourceAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "exchangeRateArsPerUsd" DECIMAL(19,6);
UPDATE "financial_entries" SET "sourceAmount" = "amountUsd";
ALTER TABLE "financial_entries" ALTER COLUMN "sourceAmount" DROP DEFAULT;

ALTER TABLE "purchases"
  ADD COLUMN "sourceCurrency" "SourceCurrency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "sourceTotal" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "exchangeRateArsPerUsd" DECIMAL(19,6);
UPDATE "purchases" SET "sourceTotal" = "totalUsd";
ALTER TABLE "purchases" ALTER COLUMN "sourceTotal" DROP DEFAULT;

ALTER TABLE "purchase_items"
  ADD COLUMN "sourceUnitCost" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sourceTotal" DECIMAL(19,2) NOT NULL DEFAULT 0;
UPDATE "purchase_items" SET "sourceUnitCost" = "unitCostUsd", "sourceTotal" = "totalUsd";
ALTER TABLE "purchase_items" ALTER COLUMN "sourceUnitCost" DROP DEFAULT, ALTER COLUMN "sourceTotal" DROP DEFAULT;

ALTER TABLE "quotes"
  ADD COLUMN "sourceCurrency" "SourceCurrency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "sourceSubtotal" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sourceDiscount" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sourceTotal" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "exchangeRateArsPerUsd" DECIMAL(19,6);
UPDATE "quotes" SET "sourceSubtotal" = "subtotalUsd", "sourceDiscount" = "discountUsd", "sourceTotal" = "totalUsd";
ALTER TABLE "quotes"
  ALTER COLUMN "sourceSubtotal" DROP DEFAULT,
  ALTER COLUMN "sourceDiscount" DROP DEFAULT,
  ALTER COLUMN "sourceTotal" DROP DEFAULT;

ALTER TABLE "quote_items"
  ADD COLUMN "sourceUnitPrice" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sourceDiscount" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sourceTotal" DECIMAL(19,2) NOT NULL DEFAULT 0;
UPDATE "quote_items" SET "sourceUnitPrice" = "unitPriceUsd", "sourceDiscount" = "discountUsd", "sourceTotal" = "totalUsd";
ALTER TABLE "quote_items"
  ALTER COLUMN "sourceUnitPrice" DROP DEFAULT,
  ALTER COLUMN "sourceDiscount" DROP DEFAULT,
  ALTER COLUMN "sourceTotal" DROP DEFAULT;

ALTER TABLE "service_cases"
  ADD COLUMN "agreedSourceCurrency" "SourceCurrency",
  ADD COLUMN "agreedSourceAmount" DECIMAL(19,2),
  ADD COLUMN "agreedExchangeRateArsPerUsd" DECIMAL(19,6),
  ADD COLUMN "directCostUsd" DECIMAL(19,2),
  ADD COLUMN "directCostSourceCurrency" "SourceCurrency",
  ADD COLUMN "directCostSourceAmount" DECIMAL(19,2),
  ADD COLUMN "directCostExchangeRateArsPerUsd" DECIMAL(19,6);
UPDATE "service_cases"
SET "agreedSourceCurrency" = 'USD', "agreedSourceAmount" = "agreedAmountUsd"
WHERE "agreedAmountUsd" IS NOT NULL;

ALTER TABLE "service_case_amount_revisions"
  ADD COLUMN "sourceCurrency" "SourceCurrency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "sourceAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
  ADD COLUMN "exchangeRateArsPerUsd" DECIMAL(19,6);
UPDATE "service_case_amount_revisions" SET "sourceAmount" = "newAmountUsd";
ALTER TABLE "service_case_amount_revisions" ALTER COLUMN "sourceAmount" DROP DEFAULT;

ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_currency_rate_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL) OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_currency_rate_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL) OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_currency_rate_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL) OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));
ALTER TABLE "service_cases" ADD CONSTRAINT "service_cases_direct_cost_currency_check"
  CHECK (("directCostUsd" IS NULL AND "directCostSourceCurrency" IS NULL AND "directCostSourceAmount" IS NULL AND "directCostExchangeRateArsPerUsd" IS NULL) OR ("directCostUsd" IS NOT NULL AND "directCostSourceCurrency" = 'USD' AND "directCostSourceAmount" IS NOT NULL AND "directCostExchangeRateArsPerUsd" IS NULL) OR ("directCostUsd" IS NOT NULL AND "directCostSourceCurrency" = 'ARS' AND "directCostSourceAmount" IS NOT NULL AND "directCostExchangeRateArsPerUsd" > 0));
