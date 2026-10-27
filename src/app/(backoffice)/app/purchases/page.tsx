import type { Metadata } from "next";
import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { DataToolbar, Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { requireRole } from "@/modules/identity/application/authorization";
import styles from "@/modules/inventory/ui/supply.module.css";
import { listPurchases } from "@/modules/purchases/application/purchase-service";
import { formatBusinessDate } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Compras" };

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status =
    params.status === "POSTED" || params.status === "VOIDED"
      ? params.status
      : undefined;
  const result = await listPurchases({
    query: params.q,
    status,
    page: Number(params.page) || 1,
  });
  const filtered = Boolean(params.q || status);
  return (
    <Page className={styles.page} size="wide">
      <PageHeader
        eyebrow="Abastecimiento"
        title="Compras"
        description="Una carga trazable actualiza stock y caja sin duplicar movimientos."
        actions={
          <>
            <Link
              href="/app/purchases/suppliers"
              className={buttonClassName("secondary")}
            >
              Proveedores
            </Link>
            <Link
              href="/app/purchases/new"
              className={buttonClassName("primary")}
            >
              <PlusIcon aria-hidden="true" />
              Nueva compra
            </Link>
          </>
        }
      />
      <DataToolbar>
        <form className="filter-bar" role="search">
          <label className="search-field">
            <span className="sr-only">Buscar compras</span>
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Número, proveedor o referencia"
            />
          </label>
          <label className="compact-field">
            <span>Estado</span>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Todas</option>
              <option value="POSTED">Posteadas</option>
              <option value="VOIDED">Anuladas</option>
            </select>
          </label>
          <button className="ghost-button">Aplicar</button>
          {filtered ? (
            <Link href="/app/purchases" className="text-link">
              Limpiar
            </Link>
          ) : null}
        </form>
      </DataToolbar>
      <div className={styles.meta}>
        <strong>{result.total}</strong>{" "}
        {result.total === 1 ? "compra" : "compras"}
      </div>
      {result.items.length ? (
        <section className={styles.list} aria-label="Compras">
          {result.items.map((purchase) => (
            <Link
              href={`/app/purchases/${purchase.id}`}
              className={`${styles.row} ${styles.purchaseRow}`}
              key={purchase.id}
            >
              <div className={styles.primary}>
                <strong>{purchase.number}</strong>
                <small>
                  {purchase.supplier.name} ·{" "}
                  {formatBusinessDate(purchase.businessDate, {
                    timeZone: "UTC",
                  })}
                </small>
              </div>
              <span className={styles.count}>
                {purchase._count.items}{" "}
                {purchase._count.items === 1 ? "ítem" : "ítems"}
              </span>
              <strong className={styles.money}>
                USD {purchase.totalUsd.toFixed(2)}
              </strong>
              {purchase.sourceCurrency === "ARS" ? (
                <small>ARS {purchase.sourceTotal.toFixed(2)}</small>
              ) : null}
              <Badge
                intent={purchase.status === "POSTED" ? "success" : "danger"}
                withIcon
              >
                {purchase.status === "POSTED" ? "Posteada" : "Anulada"}
              </Badge>
              <ArrowRightIcon className={styles.arrow} aria-hidden="true" />
            </Link>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">
            {filtered ? "Sin coincidencias" : "Primera compra"}
          </p>
          <h2>
            {filtered
              ? "No encontramos compras con estos filtros."
              : "Todavía no hay compras."}
          </h2>
          <p>
            {filtered
              ? "Probá otro criterio o limpiá los filtros."
              : "Registrá una compra para ingresar stock y su egreso juntos."}
          </p>
          <Link
            href={filtered ? "/app/purchases" : "/app/purchases/new"}
            className="ghost-button button-link"
          >
            {filtered ? "Limpiar filtros" : "Registrar compra"}
          </Link>
        </section>
      )}
    </Page>
  );
}
