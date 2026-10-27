"use client";

import { useActionState, useMemo, useState } from "react";

import {
  postPurchaseAction,
  type PurchaseFormState,
} from "@/modules/purchases/application/actions";

interface ItemOption {
  id: string;
  name: string;
  baseUnit: string;
  presentations: {
    id: string;
    name: string;
    factorToBase: string;
  }[];
}

interface Line {
  key: string;
  itemId: string;
  presentationId: string;
  quantityPurchased: string;
  unitCostUsd: string;
}

const initialState: PurchaseFormState = { status: "idle" };

function newLine(): Line {
  return {
    key: crypto.randomUUID(),
    itemId: "",
    presentationId: "",
    quantityPurchased: "1",
    unitCostUsd: "",
  };
}

export function PurchaseForm({
  suppliers,
  items,
  defaultBusinessDate,
}: {
  suppliers: { id: string; name: string }[];
  items: ItemOption[];
  defaultBusinessDate: string;
}) {
  const [state, action, pending] = useActionState(
    postPurchaseAction,
    initialState,
  );
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [exchangeRate, setExchangeRate] = useState("");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  const total = lines.reduce(
    (sum, line) =>
      sum +
      (Number(line.quantityPurchased) || 0) * (Number(line.unitCostUsd) || 0),
    0,
  );

  return (
    <form action={action} className="entity-form purchase-form">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map(
            ({ itemId, presentationId, quantityPurchased, unitCostUsd }) => ({
              itemId,
              presentationId,
              quantityPurchased,
              unitCostUsd,
            }),
          ),
        )}
      />
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <section className="form-section">
        <div className="form-section-heading">
          <h2>Compra</h2>
          <p>El gasto y el ingreso de stock se registran juntos al guardar.</p>
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span>Proveedor *</span>
            <select name="supplierId" required>
              <option value="">Seleccionar</option>
              {suppliers.map((supplier) => (
                <option value={supplier.id} key={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Fecha *</span>
            <input
              type="date"
              name="businessDate"
              defaultValue={defaultBusinessDate}
              required
            />
          </label>
          <label className="field-group">
            <span>Referencia</span>
            <input name="reference" placeholder="Factura o remito opcional" />
          </label>
          <label className="field-group">
            <span>Moneda de compra</span>
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
          <label className="field-group field-span-2">
            <span>Observaciones</span>
            <textarea name="notes" rows={2} />
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <h2>Artículos</h2>
          <p>Indicá cuánto comprás en la presentación elegida.</p>
        </div>
        <div className="purchase-lines">
          {lines.map((line, index) => {
            const item = items.find(
              (candidate) => candidate.id === line.itemId,
            );
            const presentation = item?.presentations.find(
              (candidate) => candidate.id === line.presentationId,
            );
            const factor = Number(presentation?.factorToBase ?? 1);
            const baseQuantity = (Number(line.quantityPurchased) || 0) * factor;
            const lineTotal =
              (Number(line.quantityPurchased) || 0) *
              (Number(line.unitCostUsd) || 0);
            return (
              <article className="purchase-line" key={line.key}>
                <header>
                  <strong>Ítem {index + 1}</strong>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setLines((current) =>
                          current.filter(
                            (candidate) => candidate.key !== line.key,
                          ),
                        )
                      }
                    >
                      Quitar
                    </button>
                  ) : null}
                </header>
                <div className="purchase-line-grid">
                  <label>
                    <span>Artículo *</span>
                    <select
                      value={line.itemId}
                      onChange={(event) =>
                        updateLine(line.key, {
                          itemId: event.target.value,
                          presentationId: "",
                        })
                      }
                      required
                    >
                      <option value="">Seleccionar</option>
                      {items.map((option) => (
                        <option value={option.id} key={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Presentación *</span>
                    <select
                      value={line.presentationId}
                      onChange={(event) =>
                        updateLine(line.key, {
                          presentationId: event.target.value,
                        })
                      }
                      disabled={!item}
                    >
                      <option value="">
                        Unidad base{item ? ` (${item.baseUnit})` : ""}
                      </option>
                      {item?.presentations.map((option) => (
                        <option value={option.id} key={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Cantidad *</span>
                    <input
                      value={line.quantityPurchased}
                      onChange={(event) =>
                        updateLine(line.key, {
                          quantityPurchased: event.target.value,
                        })
                      }
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label>
                    <span>Costo unitario {currency} *</span>
                    <input
                      value={line.unitCostUsd}
                      onChange={(event) =>
                        updateLine(line.key, {
                          unitCostUsd: event.target.value,
                        })
                      }
                      inputMode="decimal"
                      required
                    />
                  </label>
                </div>
                <footer>
                  <span>
                    Stock: +{baseQuantity.toFixed(3)}{" "}
                    {item?.baseUnit ?? "unidad base"}
                  </span>
                  <strong>
                    {currency} {lineTotal.toFixed(2)}
                  </strong>
                </footer>
              </article>
            );
          })}
        </div>
        <button
          type="button"
          className="ghost-button add-purchase-line"
          onClick={() => setLines((current) => [...current, newLine()])}
          disabled={lines.length >= 30}
        >
          Agregar otro artículo
        </button>
      </section>

      <div className="purchase-total-bar">
        <div>
          <small>Total compra</small>
          <strong>
            {currency} {total.toFixed(2)}
          </strong>
          {currency === "ARS" && Number(exchangeRate) > 0 ? (
            <small>
              Equivalente estimado · USD{" "}
              {(total / Number(exchangeRate)).toFixed(2)}
            </small>
          ) : null}
        </div>
        <button className="primary-button" disabled={pending || total <= 0}>
          {pending ? "Registrando…" : "Registrar compra"}
        </button>
      </div>
    </form>
  );
}
