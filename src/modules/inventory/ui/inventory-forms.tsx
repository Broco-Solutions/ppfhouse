"use client";

import { useActionState, useMemo, useState } from "react";

import {
  adjustInventoryAction,
  saveInventoryItemAction,
  type InventoryFormState,
} from "@/modules/inventory/application/actions";
import {
  inventoryUnitLabels,
  inventoryUnits,
} from "@/modules/inventory/domain/inventory-schema";

const initialState: InventoryFormState = { status: "idle" };

function ErrorMessage({ state }: { state: InventoryFormState }) {
  return state.message ? (
    <p className="form-error" role="alert">
      {state.message}
    </p>
  ) : null;
}

interface InventoryValues {
  id?: string;
  categoryId?: string;
  name?: string;
  sku?: string | null;
  baseUnit?: string;
  minimumStock?: string;
  costHintUsd?: string | null;
  notes?: string | null;
  unitLocked?: boolean;
}

export function InventoryItemForm({
  categories,
  values = {},
}: {
  categories: { id: string; name: string }[];
  values?: InventoryValues;
}) {
  const [state, action, pending] = useActionState(
    saveInventoryItemAction,
    initialState,
  );
  return (
    <form action={action} className="entity-form">
      {values.id ? (
        <input type="hidden" name="itemId" value={values.id} />
      ) : null}
      <ErrorMessage state={state} />
      <section className="form-section">
        <div className="form-section-heading">
          <h2>Identificación y medida</h2>
          <p>El stock siempre se expresa en una única unidad base.</p>
        </div>
        <div className="form-grid">
          <label className="field-group">
            <span>Categoría *</span>
            <select name="categoryId" defaultValue={values.categoryId} required>
              <option value="">Seleccionar</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Nombre *</span>
            <input name="name" defaultValue={values.name} required />
          </label>
          <label className="field-group">
            <span>SKU</span>
            <input name="sku" defaultValue={values.sku ?? ""} />
          </label>
          <label className="field-group">
            <span>Unidad base *</span>
            <select
              name="baseUnit"
              defaultValue={values.baseUnit ?? "unit"}
              disabled={values.unitLocked}
              required
            >
              {inventoryUnits.map((unit) => (
                <option value={unit} key={unit}>
                  {inventoryUnitLabels[unit]}
                </option>
              ))}
            </select>
            {values.unitLocked ? (
              <>
                <input type="hidden" name="baseUnit" value={values.baseUnit} />
                <small>
                  Bloqueada porque el artículo ya tiene movimientos.
                </small>
              </>
            ) : null}
          </label>
          <label className="field-group">
            <span>Stock mínimo *</span>
            <input
              name="minimumStock"
              defaultValue={values.minimumStock ?? "0"}
              inputMode="decimal"
              required
            />
          </label>
          <label className="field-group">
            <span>Costo orientativo USD</span>
            <input
              name="costHintUsd"
              defaultValue={values.costHintUsd ?? ""}
              inputMode="decimal"
              placeholder="Opcional"
            />
          </label>
          <label className="field-group field-span-2">
            <span>Notas internas</span>
            <textarea name="notes" defaultValue={values.notes ?? ""} rows={3} />
          </label>
        </div>
      </section>
      <div className="form-actions">
        <button className="primary-button" disabled={pending}>
          {pending
            ? "Guardando…"
            : values.id
              ? "Guardar cambios"
              : "Crear artículo"}
        </button>
      </div>
    </form>
  );
}

export function InventoryAdjustmentForm({
  itemId,
  itemName,
  unit,
  currentStock,
}: {
  itemId: string;
  itemName: string;
  unit: string;
  currentStock: string;
}) {
  const [state, action, pending] = useActionState(
    adjustInventoryAction,
    initialState,
  );
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const preview = quantity && Number(quantity) > 0 ? Number(quantity) : 0;
  const resulting =
    Number(currentStock) + (direction === "IN" ? preview : -preview);

  return (
    <form action={action} className="entity-form entity-form-compact">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <ErrorMessage state={state} />
      <div className="form-grid">
        <label className="field-group">
          <span>Movimiento *</span>
          <select
            name="direction"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "IN" | "OUT")
            }
          >
            <option value="IN">Ajuste positivo</option>
            <option value="OUT">Ajuste negativo</option>
          </select>
        </label>
        <label className="field-group">
          <span>Cantidad en {unit} *</span>
          <input
            name="quantityBase"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label className="field-group field-span-2">
          <span>Motivo *</span>
          <input
            name="reason"
            placeholder="Ej. conteo físico inicial"
            minLength={3}
            required
          />
        </label>
        {direction === "OUT" ? (
          <label className="check-field field-span-2">
            <input type="checkbox" name="allowNegative" value="true" />
            <span>
              Permitir saldo negativo como excepción administrativa documentada
            </span>
          </label>
        ) : null}
      </div>
      <div className="adjustment-preview" aria-live="polite">
        <span>{itemName}</span>
        <strong>
          {currentStock} → {resulting.toFixed(3)} {unit}
        </strong>
      </div>
      <div className="form-actions">
        <button className="primary-button" disabled={pending}>
          {pending ? "Registrando…" : "Registrar ajuste"}
        </button>
      </div>
    </form>
  );
}
