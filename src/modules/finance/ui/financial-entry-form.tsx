"use client";

import { useActionState, useMemo, useState } from "react";

import {
  saveFinancialEntryAction,
  type FinanceFormState,
} from "@/modules/finance/application/actions";
import { MoneyField } from "@/modules/money/ui/money-field";

interface FinancialEntryFormProps {
  defaultOccurredLocal: string;
  defaultServiceCaseId?: string;
  categories: { id: string; name: string; direction: "INFLOW" | "OUTFLOW" }[];
  serviceCases: {
    id: string;
    clientName: string;
    vehicle: string;
    agreedAmountUsd: string | null;
  }[];
}

const initialState: FinanceFormState = { status: "idle" };

export function FinancialEntryForm({
  defaultOccurredLocal,
  defaultServiceCaseId,
  categories,
  serviceCases,
}: FinancialEntryFormProps) {
  const [state, action, pending] = useActionState(
    saveFinancialEntryAction,
    initialState,
  );
  const [kind, setKind] = useState<
    "CUSTOMER_PAYMENT" | "CUSTOMER_REFUND" | "MANUAL_INCOME" | "MANUAL_EXPENSE"
  >("CUSTOMER_PAYMENT");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const customerEntry = kind.startsWith("CUSTOMER_");
  const direction =
    kind === "CUSTOMER_PAYMENT" || kind === "MANUAL_INCOME"
      ? "INFLOW"
      : "OUTFLOW";

  return (
    <form action={action} className="editor-form finance-form">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <section className="form-section">
        <div className="form-section-heading">
          <p className="eyebrow">Movimiento</p>
          <h2>¿Qué querés registrar?</h2>
        </div>
        <div className="form-grid two-columns">
          <label>
            <span>Tipo *</span>
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="CUSTOMER_PAYMENT">Cobro / seña</option>
              <option value="CUSTOMER_REFUND">Devolución a cliente</option>
              <option value="MANUAL_INCOME">Otro ingreso</option>
              <option value="MANUAL_EXPENSE">Egreso manual</option>
            </select>
          </label>
          <MoneyField />
          <label>
            <span>Fecha y hora *</span>
            <input
              type="datetime-local"
              name="occurredLocal"
              defaultValue={defaultOccurredLocal}
              required
            />
          </label>
          <label>
            <span>Método</span>
            <select name="paymentMethod" defaultValue="">
              <option value="">Sin especificar</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="CASH">Efectivo</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
        </div>
      </section>

      <section className="form-section">
        <div className="form-section-heading">
          <p className="eyebrow">Origen</p>
          <h2>{customerEntry ? "Servicio del cliente" : "Categoría"}</h2>
        </div>
        {customerEntry ? (
          <label>
            <span>Trabajo o servicio *</span>
            <select
              name="serviceCaseId"
              defaultValue={defaultServiceCaseId ?? ""}
              required
            >
              <option value="">Seleccionar</option>
              {serviceCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.clientName} · {item.vehicle} ·{" "}
                  {item.agreedAmountUsd
                    ? `USD ${item.agreedAmountUsd}`
                    : "importe por definir"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Categoría *</span>
            <select name="categoryId" defaultValue="" required>
              <option value="">Seleccionar</option>
              {categories
                .filter((category) => category.direction === direction)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          <span>Descripción</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Dato útil para reconocer el movimiento"
          />
        </label>
      </section>

      {state.status === "error" ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="form-actions sticky-actions">
        <button className="primary-button" disabled={pending}>
          {pending ? "Registrando…" : "Registrar movimiento"}
        </button>
      </div>
    </form>
  );
}
