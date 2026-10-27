import { Prisma, type SourceCurrency } from "@/generated/prisma/client";

export interface MoneyInput {
  currency: SourceCurrency;
  amount: string;
  exchangeRateArsPerUsd?: string;
}

export interface NormalizedMoney {
  sourceCurrency: SourceCurrency;
  sourceAmount: Prisma.Decimal;
  exchangeRateArsPerUsd: Prisma.Decimal | null;
  amountUsd: Prisma.Decimal;
}

const MONEY_PATTERN = /^\d{1,12}(?:\.\d{1,2})?$/;
const RATE_PATTERN = /^\d{1,12}(?:\.\d{1,6})?$/;

export function normalizeMoneyInput(input: MoneyInput): NormalizedMoney {
  if (!MONEY_PATTERN.test(input.amount.trim()))
    throw new Error("INVALID_MONEY");
  const sourceAmount = new Prisma.Decimal(input.amount.trim());
  if (input.currency === "ARS") {
    const rateText = input.exchangeRateArsPerUsd?.trim() ?? "";
    if (!RATE_PATTERN.test(rateText)) throw new Error("INVALID_EXCHANGE_RATE");
    const rate = new Prisma.Decimal(rateText);
    if (!rate.gt(0)) throw new Error("INVALID_EXCHANGE_RATE");
    return {
      sourceCurrency: input.currency,
      sourceAmount,
      exchangeRateArsPerUsd: rate,
      amountUsd: sourceAmount
        .div(rate)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    };
  }
  if (input.currency !== "USD") throw new Error("INVALID_CURRENCY");
  return {
    sourceCurrency: "USD",
    sourceAmount,
    exchangeRateArsPerUsd: null,
    amountUsd: sourceAmount,
  };
}

export function profitability(
  agreedAmountUsd: Prisma.Decimal | string | null,
  directCostUsd: Prisma.Decimal | string | null,
) {
  if (agreedAmountUsd === null || directCostUsd === null) return null;
  const agreed = new Prisma.Decimal(agreedAmountUsd);
  const cost = new Prisma.Decimal(directCostUsd);
  const marginUsd = agreed.minus(cost);
  return {
    marginUsd,
    marginPercent: agreed.isZero() ? null : marginUsd.div(agreed).mul(100),
  };
}

export function costCoverage(costCount: number, caseCount: number) {
  return {
    costCount,
    caseCount,
    percentage: caseCount === 0 ? null : (costCount / caseCount) * 100,
  };
}
