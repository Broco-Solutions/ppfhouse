import {
  ArrowRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import styles from "@/modules/clients/ui/clients.module.css";
import { requireRole } from "@/modules/identity/application/authorization";
import { listUsers } from "@/modules/users/application/user-service";
import { formatBusinessDateTime } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Usuarios" };

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
  return `/app/admin/users?${query}`;
}

export default async function UsersPage({ searchParams }: PageProps) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const status =
    params.status === "inactive" || params.status === "all"
      ? params.status
      : "active";
  const result = await listUsers({
    query: params.q,
    status,
    page: Number(params.page) || 1,
  });
  const filtered = Boolean(params.q || status !== "active");

  return (
    <Page className={styles.page}>
      <Link className={styles.backLink} href="/app/admin">
        ← Administración
      </Link>
      <PageHeader
        actions={
          <Link
            className={`${buttonClassName("primary")} ${styles.headerLink}`}
            href="/app/admin/users/new"
          >
            <PlusIcon aria-hidden size={18} weight="bold" />
            <span>Nuevo usuario</span>
          </Link>
        }
        description="Altas, roles y acceso del equipo al backoffice."
        eyebrow="Sólo ADMIN"
        title="Usuarios"
      />

      <form className={styles.filters} role="search">
        <label className={`${styles.filterField} ${styles.searchControl}`}>
          <span className="sr-only">Buscar usuarios</span>
          <MagnifyingGlassIcon aria-hidden size={19} />
          <input
            defaultValue={params.q}
            name="q"
            placeholder="Nombre o email"
          />
        </label>
        <label className={styles.filterField}>
          <span>Estado</span>
          <select defaultValue={status} name="status">
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <button className={styles.filterSubmit} type="submit">
          Aplicar
        </button>
        {filtered ? (
          <Link className={styles.filterClear} href="/app/admin/users">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div aria-live="polite" className={styles.resultsMeta}>
        <strong>{result.total}</strong>
        <span>{result.total === 1 ? "usuario" : "usuarios"}</span>
      </div>

      {result.items.length ? (
        <section aria-label="Resultados de usuarios" className={styles.list}>
          {result.items.map((user) => (
            <Link
              className={styles.row}
              href={`/app/admin/users/${user.id}`}
              key={user.id}
            >
              <span className={styles.primary}>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <span className={styles.garage}>
                <Badge intent={user.role === "ADMIN" ? "info" : "neutral"}>
                  {user.role}
                </Badge>
                {user.lastLoginAt
                  ? `Último acceso ${formatBusinessDateTime(user.lastLoginAt)}`
                  : "Sin accesos"}
              </span>
              <Badge
                className={styles.status}
                intent={user.active ? "success" : "neutral"}
                withIcon
              >
                {user.active ? "Activo" : "Inactivo"}
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
          <UserCircleIcon aria-hidden size={30} />
          <p className={styles.eyebrow}>Sin coincidencias</p>
          <h2>No encontramos usuarios con estos filtros.</h2>
          <p>Probá otro término o limpiá los filtros.</p>
          <Link className={styles.detailAction} href="/app/admin/users">
            Limpiar filtros
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
