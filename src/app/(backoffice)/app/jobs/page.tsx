import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { DataToolbar, Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { listJobs } from "@/modules/jobs/application/job-service";
import styles from "@/modules/jobs/ui/jobs.module.css";
import { formatBusinessDate } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Trabajos" };

function pageHref(params: { q?: string; status: string; page: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status !== "active") search.set("status", params.status);
  search.set("page", String(params.page));
  return `/app/jobs?${search}`;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "voided" || params.status === "all"
      ? params.status
      : "active";
  const result = await listJobs({
    query: params.q,
    status,
    page: Number(params.page) || 1,
  });
  const filtered = Boolean(params.q || status !== "active");
  return (
    <Page className={styles.page} size="wide">
      <PageHeader
        eyebrow="Historial real"
        title="Trabajos"
        description="Servicios efectivamente realizados, materiales utilizados y registro visual de cada vehículo."
        actions={
          <Link href="/app/jobs/new" className={buttonClassName("primary")}>
            <PlusIcon aria-hidden="true" />
            Nuevo trabajo
          </Link>
        }
      />
      <DataToolbar>
        <form className="filter-bar" role="search">
          <label className="search-field">
            <span className="sr-only">Buscar trabajos</span>
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Cliente, vehículo o servicio"
            />
          </label>
          <label className="compact-field">
            <span>Estado</span>
            <select name="status" defaultValue={status}>
              <option value="active">Realizados</option>
              <option value="voided">Anulados</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <button className="ghost-button">Aplicar</button>
          {filtered ? (
            <Link href="/app/jobs" className="text-link">
              Limpiar
            </Link>
          ) : null}
        </form>
      </DataToolbar>
      <div className={styles.meta}>
        <strong>{result.total}</strong>{" "}
        {result.total === 1 ? "trabajo documentado" : "trabajos documentados"}
      </div>
      {result.items.length ? (
        <section className={styles.list} aria-label="Resultados de trabajos">
          {result.items.map((job) => (
            <Link
              href={`/app/jobs/${job.id}`}
              className={styles.row}
              key={job.id}
            >
              <span className={styles.date}>
                <strong>{formatBusinessDate(job.performedAt)}</strong>
              </span>
              <span className={styles.identity}>
                <strong>
                  {job.serviceCase.vehicle.brand}{" "}
                  {job.serviceCase.vehicle.model}
                </strong>
                <small>{job.serviceCase.client.displayName}</small>
              </span>
              <span className={styles.services}>
                {job.services.map((item) => item.nameSnapshot).join(" · ") ||
                  "Sin servicios detallados"}
              </span>
              <Badge intent={job.voidedAt ? "danger" : "success"} withIcon>
                {job.voidedAt ? "Anulado" : "Realizado"}
              </Badge>
              <ArrowRightIcon className={styles.arrow} aria-hidden="true" />
            </Link>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">
            {filtered ? "Sin coincidencias" : "Historial vacío"}
          </p>
          <h2>
            {filtered
              ? "No encontramos trabajos con estos filtros."
              : "Todavía no hay trabajos realizados."}
          </h2>
          <p>
            {filtered
              ? "Limpiá los filtros o probá otra búsqueda."
              : "Podés completarlos desde un turno o registrarlos directamente."}
          </p>
          <Link
            href={filtered ? "/app/jobs" : "/app/jobs/new"}
            className="ghost-button button-link"
          >
            {filtered ? "Limpiar filtros" : "Registrar trabajo"}
          </Link>
        </section>
      )}
      {result.pages > 1 ? (
        <nav className="pagination" aria-label="Paginación">
          {result.page > 1 ? (
            <Link
              href={pageHref({ q: params.q, status, page: result.page - 1 })}
            >
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {result.page} de {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link
              href={pageHref({ q: params.q, status, page: result.page + 1 })}
            >
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </Page>
  );
}
