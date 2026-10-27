import type { Metadata } from "next";
import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { DataToolbar, Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { requireRole } from "@/modules/identity/application/authorization";
import { listQuotes } from "@/modules/quotes/application/quote-service";
import styles from "@/modules/quotes/ui/quotes.module.css";

export const metadata: Metadata = { title: "Presupuestos" };

const labels = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
} as const;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const result = await listQuotes({
    query: params.q,
    status: params.status,
    page: Number(params.page) || 1,
  });
  const filtered = Boolean(params.q || params.status);
  return (
    <Page className={styles.page} size="wide">
      <PageHeader
        eyebrow="Propuestas comerciales"
        title="Presupuestos"
        description="Propuestas claras, precios históricos y conversión operativa sin duplicar datos."
        actions={
          <Link href="/app/quotes/new" className={buttonClassName("primary")}>
            <PlusIcon aria-hidden="true" />
            Nuevo presupuesto
          </Link>
        }
      />
      <DataToolbar>
        <form className="filter-bar" role="search">
          <label className="search-field">
            <span className="sr-only">Buscar presupuestos</span>
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Número, cliente o vehículo"
            />
          </label>
          <label className="compact-field">
            <span>Estado</span>
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">Todos</option>
              <option value="DRAFT">Borradores</option>
              <option value="SENT">Enviados</option>
              <option value="ACCEPTED">Aceptados</option>
              <option value="REJECTED">Rechazados</option>
              <option value="expired">Vencidos</option>
            </select>
          </label>
          <button className="ghost-button">Aplicar</button>
          {filtered ? (
            <Link href="/app/quotes" className="text-link">
              Limpiar
            </Link>
          ) : null}
        </form>
      </DataToolbar>
      <div className={styles.meta}>
        <strong>{result.total}</strong>{" "}
        {result.total === 1 ? "presupuesto" : "presupuestos"}
      </div>
      {result.items.length ? (
        <section
          className={styles.list}
          aria-label="Resultados de presupuestos"
        >
          {result.items.map((quote) => {
            const expired =
              quote.status === "SENT" &&
              Boolean(quote.validUntil && quote.validUntil < result.today);
            return (
              <Link
                href={`/app/quotes/${quote.id}`}
                className={styles.row}
                key={quote.id}
              >
                <span className={styles.number}>
                  <strong>{quote.number}</strong>
                  <small>
                    {quote.issuedOn.toLocaleDateString("es-AR", {
                      timeZone: "UTC",
                    })}
                  </small>
                </span>
                <span className={styles.identity}>
                  <strong>{quote.client.displayName}</strong>
                  <small>
                    {quote.vehicle.brand} {quote.vehicle.model}
                  </small>
                </span>
                <strong className={styles.amount}>
                  USD {quote.totalUsd.toFixed(2)}
                </strong>
                <Badge
                  intent={
                    expired
                      ? "warning"
                      : quote.status === "ACCEPTED"
                        ? "success"
                        : quote.status === "REJECTED"
                          ? "danger"
                          : "neutral"
                  }
                  withIcon
                >
                  {expired ? "Vencido" : labels[quote.status]}
                </Badge>
                <ArrowRightIcon className={styles.arrow} aria-hidden="true" />
              </Link>
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">
            {filtered ? "Sin coincidencias" : "Primera propuesta"}
          </p>
          <h2>
            {filtered
              ? "No encontramos presupuestos con estos filtros."
              : "Todavía no hay presupuestos."}
          </h2>
          <p>
            {filtered
              ? "Probá otra búsqueda o limpiá los filtros."
              : "Creá una propuesta desde el catálogo o con ítems manuales."}
          </p>
          <Link
            href={filtered ? "/app/quotes" : "/app/quotes/new"}
            className="ghost-button button-link"
          >
            {filtered ? "Limpiar filtros" : "Crear presupuesto"}
          </Link>
        </section>
      )}
    </Page>
  );
}
