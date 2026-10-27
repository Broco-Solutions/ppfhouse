import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { Badge } from "@/components/ui/status";
import { requireRole } from "@/modules/identity/application/authorization";
import { inventoryUnitSymbols } from "@/modules/inventory/domain/inventory-schema";
import styles from "@/modules/inventory/ui/supply.module.css";
import { voidPurchaseAction } from "@/modules/purchases/application/actions";
import { getPurchaseDetail } from "@/modules/purchases/application/purchase-service";
import { formatBusinessDate } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Detalle de compra" };

function unitSymbol(unit: string) {
  return (
    inventoryUnitSymbols[unit as keyof typeof inventoryUnitSymbols] ?? unit
  );
}

export default async function PurchaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ purchaseId: string }>;
  searchParams: Promise<{
    created?: string;
    voided?: string;
    voidError?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const [{ purchaseId }, notice] = await Promise.all([params, searchParams]);
  const purchase = await getPurchaseDetail(purchaseId);
  if (!purchase) notFound();
  return (
    <Page className={styles.page} size="wide">
      <Link href="/app/purchases" className="back-link">
        ← Compras
      </Link>
      <DetailHeader
        eyebrow={purchase.supplier.name}
        title={purchase.number}
        description={`${formatBusinessDate(purchase.businessDate, { timeZone: "UTC" })}${purchase.reference ? ` · ${purchase.reference}` : ""}`}
        actions={
          <>
            <div className={styles.heroTotal}>
              <small>Total</small>
              <strong>USD {purchase.totalUsd.toFixed(2)}</strong>
              <Badge
                intent={purchase.status === "POSTED" ? "success" : "danger"}
                withIcon
              >
                {purchase.status === "POSTED" ? "Posteada" : "Anulada"}
              </Badge>
            </div>
            <DeleteRecordLink kind="purchase" id={purchase.id} />
          </>
        }
      />

      {notice.created ? (
        <p className="success-banner">
          Compra registrada: stock y egreso se actualizaron juntos.
        </p>
      ) : null}
      {notice.voided ? (
        <p className="success-banner">
          Compra anulada mediante movimientos compensatorios.
        </p>
      ) : null}
      {notice.voidError === "stock" ? (
        <p className="error-banner" role="alert">
          No se puede anular porque parte del stock de esta compra ya fue
          consumido. Resolvé primero la diferencia de inventario.
        </p>
      ) : null}
      <section className="detail-section">
        <div className="section-heading-row">
          <div>
            <p className="card-kicker">Detalle snapshot</p>
            <h2>Artículos comprados</h2>
          </div>
        </div>
        <div className={styles.lines}>
          {purchase.items.map((item) => (
            <article className={styles.line} key={item.id}>
              <div>
                <strong>{item.itemNameSnapshot}</strong>
                <small>
                  {item.presentationNameSnapshot} · factor{" "}
                  {item.factorToBaseSnapshot.toString()}
                </small>
              </div>
              <span>
                {item.quantityPurchased.toFixed(3)} × {purchase.sourceCurrency}{" "}
                {item.sourceUnitCost.toFixed(2)}
              </span>
              <span>
                +{item.quantityBase.toFixed(3)}{" "}
                {unitSymbol(item.baseUnitSnapshot)}
              </span>
              <strong>
                {purchase.sourceCurrency} {item.sourceTotal.toFixed(2)}
              </strong>
            </article>
          ))}
        </div>
      </section>
      {purchase.sourceCurrency === "ARS" ? (
        <p>
          1 USD = ARS {purchase.exchangeRateArsPerUsd?.toString()} · Total
          canónico USD {purchase.totalUsd.toFixed(2)}
        </p>
      ) : null}
      <section
        className={styles.integrity}
        aria-label="Integridad de movimientos"
      >
        <article>
          <span>Inventario</span>
          <strong>
            {purchase.items.every((item) => item.inventoryMovement)
              ? "Movimientos vinculados"
              : "Inconsistente"}
          </strong>
        </article>
        <article>
          <span>Caja</span>
          <strong>
            {purchase.financialEntry
              ? `Egreso USD ${purchase.financialEntry.amountUsd.toFixed(2)}`
              : "Inconsistente"}
          </strong>
        </article>
      </section>
      {purchase.notes ? (
        <section className="detail-section">
          <p className="card-kicker">Observaciones</p>
          <p>{purchase.notes}</p>
        </section>
      ) : null}
      {purchase.status === "POSTED" ? (
        <details className="detail-section disclosure-section">
          <summary>Anular compra</summary>
          <p>
            La anulación compensa stock y caja. No elimina la compra ni sus
            movimientos.
          </p>
          <form action={voidPurchaseAction} className="inline-create-form">
            <input type="hidden" name="purchaseId" value={purchase.id} />
            <label className="field-group">
              <span>Motivo *</span>
              <input name="reason" minLength={3} required />
            </label>
            <button className="danger-button">Confirmar anulación</button>
          </form>
        </details>
      ) : (
        <section className="detail-section">
          <p className="card-kicker">Anulación</p>
          <h2>Compra anulada</h2>
          <p>{purchase.voidReason}</p>
        </section>
      )}
    </Page>
  );
}
