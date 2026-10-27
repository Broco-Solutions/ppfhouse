"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export function MoneyField({
  currencyName = "currency",
  amountName = "amount",
  rateName = "exchangeRateArsPerUsd",
  amountLabel = "Importe",
  initialCurrency = "USD",
  initialAmount = "",
  initialRate = "",
  required = true,
}: {
  currencyName?: string;
  amountName?: string;
  rateName?: string;
  amountLabel?: string;
  initialCurrency?: "USD" | "ARS";
  initialAmount?: string;
  initialRate?: string;
  required?: boolean;
}) {
  const [currency, setCurrency] = useState<"USD" | "ARS">(initialCurrency);
  const [amount, setAmount] = useState(initialAmount);
  const [rate, setRate] = useState(initialRate);
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const preview = useMemo(() => {
    if (currency !== "ARS" || !amount || !rate) return null;
    const source = Number(amount);
    const exchange = Number(rate);
    if (!Number.isFinite(source) || !Number.isFinite(exchange) || exchange <= 0)
      return null;
    return (source / exchange).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currency, amount, rate]);

  return (
    <div
      className="money-field"
      data-money-field
      data-hydrated={hydrated ? "true" : "false"}
    >
      <label className="field-group">
        <span>Moneda</span>
        <select
          name={currencyName}
          value={currency}
          onChange={(event) => {
            const nextCurrency = event.target.value as "USD" | "ARS";
            for (const option of event.currentTarget.options) {
              option.defaultSelected = option.value === nextCurrency;
            }
            setCurrency(nextCurrency);
          }}
        >
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
      </label>
      <label className="field-group">
        <span>
          {amountLabel} ({currency}){required ? " *" : ""}
        </span>
        <input
          name={amountName}
          defaultValue={initialAmount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          required={required}
        />
      </label>
      {currency === "ARS" ? (
        <label className="field-group">
          <span>Cotización ARS/USD *</span>
          <input
            name={rateName}
            defaultValue={initialRate}
            onChange={(event) => setRate(event.target.value)}
            inputMode="decimal"
            required
          />
          <small>Pesos argentinos por 1 USD.</small>
          {preview ? <small aria-live="polite">≈ USD {preview}</small> : null}
        </label>
      ) : (
        <input type="hidden" name={rateName} value="" />
      )}
    </div>
  );
}
