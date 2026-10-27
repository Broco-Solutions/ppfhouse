-- Production was verified empty before this currency switch. Refuse to relabel
-- ARS obligations as USD if any salary was added since that verification.
-- Physical amountArs column names remain for compatibility with the previous
-- application during deployment; Prisma exposes them as amountUsd via @map.
BEGIN;
LOCK TABLE "salaries", "salary_rates", "salary_months", "salary_events" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "salaries")
    OR EXISTS (SELECT 1 FROM "salary_rates")
    OR EXISTS (SELECT 1 FROM "salary_months")
    OR EXISTS (SELECT 1 FROM "salary_events")
    OR EXISTS (SELECT 1 FROM "financial_entries" WHERE "type"::text = 'SALARY_PAYMENT')
  THEN
    RAISE EXCEPTION 'SALARY_CURRENCY_REVIEW_REQUIRED: existing salary data must be reviewed before switching from ARS to USD';
  END IF;
END $$;

ALTER TABLE "financial_entries" DROP CONSTRAINT "financial_entries_salary_check";
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_salary_check" CHECK (
  ("type"::text <> 'SALARY_PAYMENT' OR (
    "direction" = 'OUTFLOW' AND "sourceCurrency" = 'USD' AND
    "exchangeRateArsPerUsd" IS NULL AND "sourceAmount" = "amountUsd" AND
    "salaryMonthId" IS NOT NULL AND "serviceCaseId" IS NULL
  )) AND
  ("salaryMonthId" IS NULL OR "type"::text IN ('SALARY_PAYMENT', 'REVERSAL'))
);
COMMIT;
