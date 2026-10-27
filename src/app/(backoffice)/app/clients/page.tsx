import {
  ArrowRightIcon,
  CarProfileIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { listClients } from "@/modules/clients/application/client-service";
import styles from "@/modules/clients/ui/clients.module.css";

export const metadata: Metadata = { title: "Clientes" };

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

function pageHref(params: { q?: string; status?: string; page: number }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status && params.status !== "active") {
    query.set("status", params.status);
  }
  query.set("page", String(params.page));
  return `/app/clients?${query}`;
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status =
    params.status === "archived" || params.status === "all"
      ? params.status
      : "active";
  const result = await listClients({
    query: params.q,
    status,
    page: Number(params.page) || 1,
  });
  const filtered = Boolean(params.q || status !== "active");

  return (
    <Page className={styles.page}>
      <PageHeader
        actions={
          <Link
            className={`${buttonClassName("primary")} ${styles.headerLink}`}
            href="/app/clients/new"
          >
            <PlusIcon aria-hidden size={18} weight="bold" />
            <span>Nuevo cliente</span>
          </Link>
        }
        description="Encontrá una persona, su contacto y todo su garage sin perder contexto."
        eyebrow="Relaciones"
        title="Clientes"
      />

      <form className={styles.filters} role="search">
        <label className={`${styles.filterField} ${styles.searchControl}`}>
          <span className="sr-only">Buscar clientes</span>
          <MagnifyingGlassIcon aria-hidden size={19} />
          <input
            defaultValue={params.q}
            name="q"
            placeholder="Nombre, teléfono o vehículo"
          />
        </label>
        <label className={styles.filterField}>
          <span>Estado</span>
          <select defaultValue={status} name="status">
            <option value="active">Activos</option>
            <option value="archived">Archivados</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <button className={styles.filterSubmit} type="submit">
          Aplicar
        </button>
        {filtered ? (
          <Link className={styles.filterClear} href="/app/clients">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div aria-live="polite" className={styles.resultsMeta}>
        <strong>{result.total}</strong>
        <span>{result.total === 1 ? "cliente" : "clientes"}</span>
      </div>

      {result.items.length ? (
        <section aria-label="Resultados de clientes" className={styles.list}>
          {result.items.map((client) => (
            <Link
              className={styles.row}
              href={`/app/clients/${client.id}`}
              key={client.id}
            >
              <span className={styles.primary}>
                <strong>{client.displayName}</strong>
                <small>
                  {client.phone || client.email || "Sin contacto cargado"}
                </small>
              </span>
              <span className={styles.garage}>
                <CarProfileIcon aria-hidden size={20} />
                {client.vehicles.length
                  ? client.vehicles
                      .map((vehicle) => `${vehicle.brand} ${vehicle.model}`)
                      .join(" · ")
                  : "Sin vehículos"}
              </span>
              <Badge
                className={styles.status}
                intent={client.active ? "success" : "neutral"}
                withIcon
              >
                {client.active ? "Activo" : "Archivado"}
              </Badge>
              <ArrowRightIcon
                aria-hidden
                className={styles.rowArrow}
                size={20}
              />
            </Link>
          ))}
        </section>
      ) : (
        <section className={styles.empty}>
          <UsersThreeIcon aria-hidden size={30} />
          <p className={styles.eyebrow}>
            {filtered ? "Sin coincidencias" : "Primera carga"}
          </p>
          <h2>
            {filtered
              ? "No encontramos clientes con estos filtros."
              : "Todavía no hay clientes."}
          </h2>
          <p>
            {filtered
              ? "Probá otro término o limpiá los filtros."
              : "Creá el primero y agregá su vehículo en el siguiente paso."}
          </p>
          <Link
            className={styles.detailAction}
            href={filtered ? "/app/clients" : "/app/clients/new"}
          >
            {filtered ? "Limpiar filtros" : "Crear cliente"}
          </Link>
        </section>
      )}

      {result.pages > 1 ? (
        <nav aria-label="Paginación" className={styles.pagination}>
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
