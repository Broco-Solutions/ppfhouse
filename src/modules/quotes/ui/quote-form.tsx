"use client";

import { useActionState, useMemo, useState } from "react";

import { ClientVehiclePicker } from "@/modules/clients/ui/client-vehicle-picker";
import {
  saveQuoteAction,
  type QuoteFormState,
} from "@/modules/quotes/application/actions";
import { usdToArsText } from "@/modules/money/domain/money-text";
import {
  calculateQuoteSummary,
  formatQuoteMoney,
} from "@/modules/quotes/domain/quote-summary";

import styles from "./quotes.module.css";

const initialState: QuoteFormState = { status: "idle" };

interface QuoteOptions {
  clients: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    vehicleCount: number;
  }[];
  vehicles: {
    id: string;
    clientId: string;
    brand: string;
    model: string;
    version: string | null;
    year: number | null;
    color: string | null;
    vehicleClass: "SEDAN" | "SUV" | "PICKUP" | "OTHER" | null;
  }[];
  services: {
    id: string;
    name: string;
    commercialDescription: string | null;
    basePriceUsd: string | null;
    category: { name: string };
  }[];
}

interface Line {
  key: string;
  serviceId: string;
  name: string;
  description: string;
  quantity: string;
  unitPriceUsd: string;
  discountUsd: string;
}

interface QuoteValues {
  quoteId?: string;
  clientId?: string;
  vehicleId?: string;
  issuedOn: string;
  validUntil?: string;
  notes?: string | null;
  terms?: string | null;
  discountUsd?: string;
  currency?: "USD" | "ARS";
  exchangeRateArsPerUsd?: string | null;
  items?: Omit<Line, "key">[];
}

function blankLine(): Line {
  return {
    key: crypto.randomUUID(),
    serviceId: "",
    name: "",
    description: "",
    quantity: "1",
    unitPriceUsd: "0",
    discountUsd: "0",
  };
}

export function QuoteForm({
  options,
  values,
}: {
  options: QuoteOptions;
  values: QuoteValues;
}) {
  const [state, action, pending] = useActionState(
    saveQuoteAction,
    initialState,
  );
  const [lines, setLines] = useState<Line[]>(
    values.items?.length
      ? values.items.map((item) => ({ ...item, key: crypto.randomUUID() }))
      : [blankLine()],
  );
  const [globalDiscount, setGlobalDiscount] = useState(
    values.discountUsd ?? "0",
  );
  const [currency, setCurrency] = useState<"USD" | "ARS">(
    values.currency ?? "USD",
  );
  const [exchangeRate, setExchangeRate] = useState(
    values.exchangeRateArsPerUsd ?? "",
  );
  const summary = useMemo(
    () => calculateQuoteSummary(lines, globalDiscount, exchangeRate),
    [exchangeRate, globalDiscount, lines],
  );

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  return (
    <form action={action} className={styles.editor}>
      {values.quoteId ? (
        <input type="hidden" name="quoteId" value={values.quoteId} />
      ) : null}
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Cliente y vehículo</h2>
        </div>
        <ClientVehiclePicker
          initialClientId={values.clientId}
          initialClients={options.clients}
          initialVehicleId={values.vehicleId}
          initialVehicles={options.vehicles}
        />
        <div className={`${styles.dateGrid} form-grid`}>
          <label className="field-group">
            <span>Fecha *</span>
            <input
              type="date"
              name="issuedOn"
              defaultValue={values.issuedOn}
              required
            />
          </label>
          <label className="field-group">
            <span>Válido hasta</span>
            <input
              type="date"
              name="validUntil"
              defaultValue={values.validUntil}
            />
          </label>
        </div>
      </section>
      <section className="quote-lines-section">
        <div className={`${styles.currencyGrid} form-grid two-columns`}>
          <label className="field-group">
            <span>Moneda del presupuesto</span>
            <select
              name="currency"
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as "USD" | "ARS")
              }
            >
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </label>
          {currency === "ARS" ? (
            <label className="field-group">
              <span>Cotización ARS/USD *</span>
              <input
                name="exchangeRateArsPerUsd"
                value={exchangeRate}
                onChange={(event) => setExchangeRate(event.target.value)}
                inputMode="decimal"
                required
              />
              <small>Pesos argentinos por 1 USD.</small>
            </label>
          ) : (
            <input type="hidden" name="exchangeRateArsPerUsd" value="" />
          )}
        </div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Propuesta</p>
            <h2>Servicios e ítems</h2>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setLines((current) => [...current, blankLine()])}
          >
            Agregar ítem
          </button>
        </div>
        <div className="quote-lines">
          {lines.map((line, index) => (
            <article className="quote-line-card" key={line.key}>
              <header>
                <strong>Ítem {index + 1}</strong>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.key !== line.key),
                      )
                    }
                  >
                    Quitar
                  </button>
                ) : null}
              </header>
              <label className="field-group quote-service-select">
                <span>Desde catálogo</span>
                <select
                  name="itemServiceId"
                  value={line.serviceId}
                  onChange={(event) => {
                    const service = options.services.find(
                      (item) => item.id === event.target.value,
                    );
                    updateLine(
                      line.key,
                      service
                        ? {
                            serviceId: service.id,
                            name: service.name,
                            description: service.commercialDescription ?? "",
                            unitPriceUsd:
                              currency === "ARS"
                                ? usdToArsText(
                                    service.basePriceUsd ?? "0",
                                    exchangeRate,
                                  )
                                : (service.basePriceUsd ?? "0"),
                          }
                        : { serviceId: "" },
                    );
                  }}
                >
                  <option value="">Ítem manual</option>
                  {options.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.category.name} · {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="quote-line-grid">
                <label className="field-group quote-line-name">
                  <span>Nombre *</span>
                  <input
                    name="itemName"
                    value={line.name}
                    onChange={(event) =>
                      updateLine(line.key, { name: event.target.value })
                    }
                    maxLength={180}
                    required
                  />
                </label>
                <label className="field-group quote-line-description">
                  <span>Descripción</span>
                  <textarea
                    name="itemDescription"
                    value={line.description}
                    onChange={(event) =>
                      updateLine(line.key, { description: event.target.value })
                    }
                    rows={2}
                  />
                </label>
                <label className="field-group">
                  <span>Cantidad *</span>
                  <input
                    name="itemQuantity"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(line.key, { quantity: event.target.value })
                    }
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className="field-group">
                  <span>Precio unitario {currency} *</span>
                  <input
                    name="itemUnitPriceUsd"
                    value={line.unitPriceUsd}
                    onChange={(event) =>
                      updateLine(line.key, { unitPriceUsd: event.target.value })
                    }
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className="field-group">
                  <span>Descuento {currency}</span>
                  <input
                    name="itemDiscountUsd"
                    value={line.discountUsd}
                    onChange={(event) =>
                      updateLine(line.key, { discountUsd: event.target.value })
                    }
                    inputMode="decimal"
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Condiciones</h2>
          <p>Textos claros que también aparecerán en el PDF.</p>
        </div>
        <div className="form-grid">
          <label className="field-group field-span-2">
            <span>Observaciones</span>
            <textarea name="notes" defaultValue={values.notes ?? ""} rows={3} />
          </label>
          <label className="field-group field-span-2">
            <span>Condiciones</span>
            <textarea name="terms" defaultValue={values.terms ?? ""} rows={4} />
          </label>
        </div>
      </section>
      <aside className={styles.summary} aria-label="Resumen del presupuesto">
        <header className={styles.summaryHeader}>
          <span>Resumen del presupuesto</span>
          <small>Importes estimados</small>
        </header>
        <div className={styles.summaryAmount}>
          <span>Subtotal estimado</span>
          <strong>{formatQuoteMoney(summary.subtotal, currency)}</strong>
        </div>
        <label className={styles.discountField}>
          <span>Descuento general ({currency})</span>
          <input
            name="discountUsd"
            value={globalDiscount}
            onChange={(event) => setGlobalDiscount(event.target.value)}
            inputMode="decimal"
          />
          <small>
            Opcional · se descuenta una sola vez del subtotal completo.
          </small>
        </label>
        <div className={styles.discountPreview} aria-live="polite">
          <span>− Descuento general</span>
          <strong>− {formatQuoteMoney(summary.discount, currency)}</strong>
        </div>
        <div className={styles.summaryTotal}>
          <span>Total estimado</span>
          <strong>{formatQuoteMoney(summary.total, currency)}</strong>
        </div>
        {currency === "ARS" && summary.totalUsd !== null ? (
          <div className={styles.usdEquivalent} aria-live="polite">
            <span>Equivalente estimado</span>
            <strong>{formatQuoteMoney(summary.totalUsd, "USD")}</strong>
          </div>
        ) : null}
        <button className="primary-button" disabled={pending}>
          {pending
            ? "Guardando…"
            : values.quoteId
              ? "Guardar borrador"
              : "Crear presupuesto"}
        </button>
      </aside>
    </form>
  );
}
