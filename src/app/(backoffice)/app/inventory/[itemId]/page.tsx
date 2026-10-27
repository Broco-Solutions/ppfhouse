import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  createPresentationAction,
  reverseInventoryMovementAction,
  toggleInventoryItemAction,
  togglePresentationAction,
} from "@/modules/inventory/application/actions";
import {
  getInventoryItemDetail,
  listInventoryCategories,
  reconcileInventory,
} from "@/modules/inventory/application/inventory-service";
import { inventoryUnitSymbols } from "@/modules/inventory/domain/inventory-schema";
import {
  InventoryAdjustmentForm,
  InventoryItemForm,
} from "@/modules/inventory/ui/inventory-forms";
import { formatBusinessDateTime } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Detalle de inventario" };

const movementLabels = {
  PURCHASE: "Compra",
  CONSUMPTION: "Consumo",
  ADJUSTMENT_IN: "Ajuste +",
  ADJUSTMENT_OUT: "Ajuste −",
  RETURN: "Devolución",
  REVERSAL: "Reversión",
} as const;

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{
    saved?: string;
    adjusted?: string;
    reversed?: string;
  }>;
}) {
  const session = await requireRole("ADMIN", "STAFF");
  const [{ itemId }, notice] = await Promise.all([params, searchParams]);
  const isAdmin = session.user.role === "ADMIN";
  const [item, reconciliation, categories] = await Promise.all([
    getInventoryItemDetail(itemId, isAdmin),
    isAdmin ? reconcileInventory(itemId) : Promise.resolve([]),
    isAdmin ? listInventoryCategories(true) : Promise.resolve([]),
  ]);
  if (!item) notFound();
  const low = item.currentStock.lte(item.minimumStock);
  const reconciled = reconciliation[0]?.matches ?? true;
  const unitLabel =
    inventoryUnitSymbols[item.baseUnit as keyof typeof inventoryUnitSymbols] ??
    item.baseUnit;

  return (
    <div className="page-stack">
      <Link href="/app/inventory" className="back-link">
        ← Inventario
      </Link>
      <header className="page-header page-header-actions inventory-detail-header">
        <div>
          <p className="eyebrow">{item.category.name}</p>
          <h1>{item.name}</h1>
          <p className="page-description">
            {item.sku ? `SKU ${item.sku} · ` : ""}medido en {unitLabel}.
          </p>
        </div>
        <div className="header-actions">
          <div className={`hero-stock ${low ? "is-low" : ""}`}>
            <small>Stock actual</small>
            <strong>{item.currentStock.toFixed(3)}</strong>
            <span>{unitLabel}</span>
          </div>
          <DeleteRecordLink kind="inventoryItem" id={item.id} />
        </div>
      </header>
      {notice.saved ? (
        <p className="success-banner">Artículo guardado.</p>
      ) : null}
      {notice.adjusted ? (
        <p className="success-banner">Ajuste registrado con trazabilidad.</p>
      ) : null}
      {notice.reversed ? (
        <p className="success-banner">
          Movimiento compensado sin borrar el historial.
        </p>
      ) : null}
      {low ? (
        <p className="warning-banner">
          Stock bajo: el mínimo configurado es {item.minimumStock.toFixed(3)}{" "}
          {unitLabel}.
        </p>
      ) : null}

      {isAdmin ? (
        <>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <p className="card-kicker">Control</p>
                <h2>Ajustar stock</h2>
              </div>
              <span
                className={
                  reconciled
                    ? "status-badge status-active"
                    : "status-badge status-danger"
                }
              >
                {reconciled ? "Ledger conciliado" : "Revisar diferencia"}
              </span>
            </div>
            <InventoryAdjustmentForm
              itemId={item.id}
              itemName={item.name}
              unit={unitLabel}
              currentStock={item.currentStock.toFixed(3)}
            />
          </section>

          <section className="detail-section">
            <div className="section-heading">
              <div>
                <p className="card-kicker">Compras futuras</p>
                <h2>Presentaciones</h2>
              </div>
            </div>
            <form
              action={createPresentationAction}
              className="inline-create-form"
            >
              <input type="hidden" name="itemId" value={item.id} />
              <label className="field-group">
                <span>Nombre</span>
                <input name="name" placeholder="Rollo 15 m" required />
              </label>
              <label className="field-group">
                <span>Factor a {unitLabel}</span>
                <input
                  name="factorToBase"
                  inputMode="decimal"
                  placeholder="15"
                  required
                />
              </label>
              <button className="ghost-button">Agregar</button>
            </form>
            {item.presentations.length ? (
              <div className="presentation-list">
                {item.presentations.map((presentation) => (
                  <article key={presentation.id}>
                    <div>
                      <strong>{presentation.name}</strong>
                      <small>
                        1 = {presentation.factorToBase.toString()} {unitLabel}
                      </small>
                    </div>
                    <span
                      className={
                        presentation.active
                          ? "status-badge status-active"
                          : "status-badge"
                      }
                    >
                      {presentation.active ? "Activa" : "Inactiva"}
                    </span>
                    <form action={togglePresentationAction}>
                      <input
                        type="hidden"
                        name="presentationId"
                        value={presentation.id}
                      />
                      <input
                        type="hidden"
                        name="active"
                        value={String(!presentation.active)}
                      />
                      <button className="text-button">
                        {presentation.active ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <div className="inline-empty">
                <strong>Sin presentaciones.</strong>
                <p>
                  El stock base funciona igual; agregalas antes de registrar
                  compras.
                </p>
              </div>
            )}
          </section>

          <details className="detail-section disclosure-section">
            <summary>Editar artículo</summary>
            <InventoryItemForm
              categories={categories}
              values={{
                id: item.id,
                categoryId: item.categoryId,
                name: item.name,
                sku: item.sku,
                baseUnit: item.baseUnit,
                minimumStock: item.minimumStock.toString(),
                costHintUsd:
                  "costHintUsd" in item && item.costHintUsd
                    ? item.costHintUsd.toString()
                    : null,
                notes: item.notes,
                unitLocked: item.movements.length > 0,
              }}
            />
            <form
              action={toggleInventoryItemAction}
              className="danger-zone-inline"
            >
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="active" value={String(!item.active)} />
              <button className="text-button">
                {item.active ? "Archivar artículo" : "Restaurar artículo"}
              </button>
            </form>
          </details>
        </>
      ) : null}

      <section className="detail-section">
        <div className="section-heading">
          <div>
            <p className="card-kicker">Trazabilidad</p>
            <h2>Historial de movimientos</h2>
          </div>
          <span>{item.movements.length} recientes</span>
        </div>
        {item.movements.length ? (
          <div className="movement-list">
            {item.movements.map((movement) => (
              <article
                key={movement.id}
                className={movement.reversalOfId ? "is-reversal" : ""}
              >
                <div className="movement-sign">
                  <strong>
                    {movement.signedQuantityBase.isPositive() ? "+" : ""}
                    {movement.signedQuantityBase.toFixed(3)}
                  </strong>
                  <small>{movement.unitSnapshot}</small>
                </div>
                <div>
                  <strong>{movementLabels[movement.type]}</strong>
                  <p>{movement.note}</p>
                  <small>{formatBusinessDateTime(movement.occurredAt)}</small>
                </div>
                {isAdmin &&
                movement.type !== "REVERSAL" &&
                !movement.reversedBy ? (
                  <form
                    action={reverseInventoryMovementAction}
                    className="movement-reverse-form"
                  >
                    <input type="hidden" name="itemId" value={item.id} />
                    <input
                      type="hidden"
                      name="movementId"
                      value={movement.id}
                    />
                    <input
                      name="reason"
                      placeholder="Motivo de reversión"
                      minLength={3}
                      aria-label="Motivo de reversión"
                      required
                    />
                    <button className="text-button">Revertir</button>
                  </form>
                ) : movement.reversedBy ? (
                  <span className="status-badge">Revertido</span>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="inline-empty">
            <strong>Sin movimientos todavía.</strong>
            <p>
              El primer ajuste establecerá el stock inicial y bloqueará la
              unidad base.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
