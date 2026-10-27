"use client";

import { useActionState, useMemo, useState } from "react";

import {
  addConsumptionAction,
  correctConsumptionAction,
  type ConsumptionFormState,
} from "@/modules/job-consumptions/application/actions";

const initialState: ConsumptionFormState = { status: "idle" };

interface InventoryOption {
  id: string;
  name: string;
  baseUnit: string;
  currentStock: string;
  category: string;
}

export function ConsumptionForm({
  jobId,
  items,
}: {
  jobId: string;
  items: InventoryOption[];
}) {
  const [state, action, pending] = useActionState(
    addConsumptionAction,
    initialState,
  );
  const [query, setQuery] = useState("");
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const filtered = items.filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = items.find((item) => item.id === itemId);

  return (
    <form action={action} className="entity-form entity-form-compact">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <div className="form-grid">
        <label className="field-group field-span-2">
          <span>Buscar insumo</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              const firstMatch = items.find((item) =>
                `${item.name} ${item.category}`
                  .toLowerCase()
                  .includes(next.toLowerCase()),
              );
              setItemId(firstMatch?.id ?? "");
            }}
            placeholder="Ej. PPF, coating, shampoo"
          />
        </label>
        <label className="field-group field-span-2">
          <span>Insumo *</span>
          <select
            name="itemId"
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            required
          >
            {!filtered.length ? (
              <option value="">Sin coincidencias</option>
            ) : null}
            {filtered.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.currentStock} {item.baseUnit}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Cantidad{selected ? ` en ${selected.baseUnit}` : ""} *</span>
          <input
            name="quantityBase"
            inputMode="decimal"
            placeholder="0.000"
            required
          />
        </label>
        <label className="field-group">
          <span>Nota</span>
          <input name="note" maxLength={300} placeholder="Opcional" />
        </label>
      </div>
      {selected ? (
        <p className="form-hint" aria-live="polite">
          Disponible: {selected.currentStock} {selected.baseUnit}. La cantidad
          siempre se carga en la unidad base.
        </p>
      ) : null}
      <div className="form-actions">
        <button className="primary-button" disabled={pending || !itemId}>
          {pending ? "Registrando…" : "Registrar consumo"}
        </button>
      </div>
    </form>
  );
}

export function ConsumptionCorrectionForm({
  jobId,
  consumptionId,
  unit,
  currentQuantity,
}: {
  jobId: string;
  consumptionId: string;
  unit: string;
  currentQuantity: string;
}) {
  const [state, action, pending] = useActionState(
    correctConsumptionAction,
    initialState,
  );
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  return (
    <form action={action} className="compact-form">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="consumptionId" value={consumptionId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {state.message ? (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <label className="field-group">
        <span>Nueva cantidad en {unit} *</span>
        <input
          name="quantityBase"
          defaultValue={currentQuantity}
          inputMode="decimal"
          required
        />
      </label>
      <label className="field-group">
        <span>Motivo *</span>
        <input name="reason" minLength={3} maxLength={300} required />
      </label>
      <button className="secondary-button" disabled={pending}>
        {pending ? "Corrigiendo…" : "Guardar corrección"}
      </button>
    </form>
  );
}
