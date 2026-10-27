ALTER TABLE "financial_entries" DROP CONSTRAINT "financial_entries_currency_rate_check";
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_currency_rate_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL AND "sourceAmount" = "amountUsd") OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));

ALTER TABLE "purchases" DROP CONSTRAINT "purchases_currency_rate_check";
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_currency_rate_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL AND "sourceTotal" = "totalUsd") OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));

ALTER TABLE "quotes" DROP CONSTRAINT "quotes_currency_rate_check";
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_currency_rate_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL AND "sourceSubtotal" = "subtotalUsd" AND "sourceDiscount" = "discountUsd" AND "sourceTotal" = "totalUsd") OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));

ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_source_amounts_check"
  CHECK ("sourceUnitPrice" >= 0 AND "sourceDiscount" >= 0 AND "sourceTotal" >= 0);
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_source_amounts_check"
  CHECK ("sourceUnitCost" >= 0 AND "sourceTotal" >= 0);

ALTER TABLE "service_case_amount_revisions" ADD CONSTRAINT "service_case_amount_revisions_currency_check"
  CHECK (("sourceCurrency" = 'USD' AND "exchangeRateArsPerUsd" IS NULL AND "sourceAmount" = "newAmountUsd") OR ("sourceCurrency" = 'ARS' AND "exchangeRateArsPerUsd" > 0));

ALTER TABLE "service_cases" ADD CONSTRAINT "service_cases_agreed_currency_check"
  CHECK (("agreedAmountUsd" IS NULL AND "agreedSourceCurrency" IS NULL AND "agreedSourceAmount" IS NULL AND "agreedExchangeRateArsPerUsd" IS NULL) OR ("agreedAmountUsd" IS NOT NULL AND "agreedSourceCurrency" = 'USD' AND "agreedSourceAmount" = "agreedAmountUsd" AND "agreedExchangeRateArsPerUsd" IS NULL) OR ("agreedAmountUsd" IS NOT NULL AND "agreedSourceCurrency" = 'ARS' AND "agreedSourceAmount" IS NOT NULL AND "agreedExchangeRateArsPerUsd" > 0));
