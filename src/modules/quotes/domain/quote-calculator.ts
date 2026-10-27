const MONEY_SCALE = 2;
const QUANTITY_SCALE = 3;

function parseFixed(value: string, scale: number, field: string): bigint {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match || (match[2]?.length ?? 0) > scale)
    throw new Error(`INVALID_${field}`);
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(scale, "0");
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction || "0");
}

function fixed(value: bigint, scale: number) {
  const divisor = 10n ** BigInt(scale);
  const whole = value / divisor;
  const fraction = String(value % divisor).padStart(scale, "0");
  return `${whole}.${fraction}`;
}

export interface QuoteLineInput {
  serviceId?: string;
  name: string;
  description?: string;
  quantity: string;
  unitPriceUsd: string;
  discountUsd: string;
}

function convertCents(
  sourceCents: bigint,
  currency: "USD" | "ARS",
  rate?: string,
) {
  if (currency === "USD") return sourceCents;
  const parsed = /^\d+(?:\.\d{1,6})?$/.exec(rate ?? "");
  if (!parsed) throw new Error("INVALID_EXCHANGE_RATE");
  const rateMicros = parseFixed(rate!, 6, "EXCHANGE_RATE");
  if (rateMicros <= 0n) throw new Error("INVALID_EXCHANGE_RATE");
  return (sourceCents * 1_000_000n + rateMicros / 2n) / rateMicros;
}

export function calculateQuote(
  lines: readonly QuoteLineInput[],
  globalDiscountUsd: string,
  currency: "USD" | "ARS" = "USD",
  exchangeRateArsPerUsd?: string,
) {
  if (!lines.length) throw new Error("QUOTE_ITEMS_REQUIRED");
  const items = lines.map((line, index) => {
    const quantity = parseFixed(line.quantity, QUANTITY_SCALE, "QUANTITY");
    const unitPrice = parseFixed(line.unitPriceUsd, MONEY_SCALE, "MONEY");
    const discount = parseFixed(line.discountUsd || "0", MONEY_SCALE, "MONEY");
    if (quantity <= 0n) throw new Error("INVALID_QUANTITY");
    const gross = (quantity * unitPrice + 500n) / 1_000n;
    if (discount > gross) throw new Error("ITEM_DISCOUNT_EXCEEDS_GROSS");
    return {
      serviceId: line.serviceId,
      nameSnapshot: line.name.trim(),
      descriptionSnapshot: line.description?.trim() || undefined,
      quantity: fixed(quantity, QUANTITY_SCALE),
      unitPriceUsd: fixed(
        convertCents(unitPrice, currency, exchangeRateArsPerUsd),
        MONEY_SCALE,
      ),
      discountUsd: fixed(
        convertCents(discount, currency, exchangeRateArsPerUsd),
        MONEY_SCALE,
      ),
      totalUsd: fixed(
        convertCents(gross - discount, currency, exchangeRateArsPerUsd),
        MONEY_SCALE,
      ),
      sourceUnitPrice: fixed(unitPrice, MONEY_SCALE),
      sourceDiscount: fixed(discount, MONEY_SCALE),
      sourceTotal: fixed(gross - discount, MONEY_SCALE),
      sortOrder: index,
      totalCents: gross - discount,
    };
  });
  const sourceSubtotal = items.reduce((sum, item) => sum + item.totalCents, 0n);
  const subtotal = items.reduce(
    (sum, item) => sum + BigInt(item.totalUsd.replace(".", "")),
    0n,
  );
  const globalDiscount = parseFixed(
    globalDiscountUsd || "0",
    MONEY_SCALE,
    "MONEY",
  );
  if (globalDiscount > sourceSubtotal)
    throw new Error("GLOBAL_DISCOUNT_EXCEEDS_SUBTOTAL");
  return {
    items: items.map((item) => ({
      serviceId: item.serviceId,
      nameSnapshot: item.nameSnapshot,
      descriptionSnapshot: item.descriptionSnapshot,
      quantity: item.quantity,
      unitPriceUsd: item.unitPriceUsd,
      discountUsd: item.discountUsd,
      totalUsd: item.totalUsd,
      sourceUnitPrice: item.sourceUnitPrice,
      sourceDiscount: item.sourceDiscount,
      sourceTotal: item.sourceTotal,
      sortOrder: item.sortOrder,
    })),
    subtotalUsd: fixed(subtotal, MONEY_SCALE),
    discountUsd: fixed(
      convertCents(globalDiscount, currency, exchangeRateArsPerUsd),
      MONEY_SCALE,
    ),
    totalUsd: fixed(
      subtotal -
        BigInt(
          fixed(
            convertCents(globalDiscount, currency, exchangeRateArsPerUsd),
            MONEY_SCALE,
          ).replace(".", ""),
        ),
      MONEY_SCALE,
    ),
    sourceSubtotal: fixed(sourceSubtotal, MONEY_SCALE),
    sourceDiscount: fixed(globalDiscount, MONEY_SCALE),
    sourceTotal: fixed(sourceSubtotal - globalDiscount, MONEY_SCALE),
  };
}
