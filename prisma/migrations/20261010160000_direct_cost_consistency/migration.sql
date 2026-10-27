-- Preserve the distinction between an unassigned cost (all NULL) and a known
-- cost, including a real zero. Source metadata must agree with canonical USD.
ALTER TABLE "service_cases"
  DROP CONSTRAINT "service_cases_direct_cost_currency_check";

ALTER TABLE "service_cases"
  ADD CONSTRAINT "service_cases_direct_cost_currency_check"
  CHECK (
    (
      "directCostUsd" IS NULL
      AND "directCostSourceCurrency" IS NULL
      AND "directCostSourceAmount" IS NULL
      AND "directCostExchangeRateArsPerUsd" IS NULL
    )
    OR (
      "directCostUsd" IS NOT NULL
      AND "directCostUsd" >= 0
      AND "directCostSourceCurrency" = 'USD'
      AND "directCostSourceAmount" IS NOT NULL
      AND "directCostSourceAmount" = "directCostUsd"
      AND "directCostExchangeRateArsPerUsd" IS NULL
    )
    OR (
      "directCostUsd" IS NOT NULL
      AND "directCostUsd" >= 0
      AND "directCostSourceCurrency" = 'ARS'
      AND "directCostSourceAmount" IS NOT NULL
      AND "directCostSourceAmount" >= 0
      AND "directCostExchangeRateArsPerUsd" IS NOT NULL
      AND "directCostExchangeRateArsPerUsd" > 0
    )
  );
