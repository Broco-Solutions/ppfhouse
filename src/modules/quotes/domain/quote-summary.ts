export interface QuoteSummaryLine {
  discountUsd: string;
  quantity: string;
  unitPriceUsd: string;
}

function numeric(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateQuoteSummary(
  lines: readonly QuoteSummaryLine[],
  generalDiscount: string,
  exchangeRate: string,
) {
  const subtotal = lines.reduce((sum, line) => {
    const gross = Math.max(
      0,
      numeric(line.quantity) * numeric(line.unitPriceUsd),
    );
    return sum + Math.max(0, gross - Math.max(0, numeric(line.discountUsd)));
  }, 0);
  const discount = Math.max(0, numeric(generalDiscount));
  const total = Math.max(0, subtotal - discount);
  const rate = numeric(exchangeRate);
  return {
    discount,
    subtotal,
    total,
    totalUsd: rate > 0 ? total / rate : null,
  };
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatQuoteMoney(value: number, currency: "USD" | "ARS") {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }
  return `${currency} ${formatter.format(Number.isFinite(value) ? value : 0)}`;
}
