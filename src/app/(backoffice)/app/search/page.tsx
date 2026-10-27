import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { requireUser } from "@/modules/identity/application/session";
import { globalSearch } from "@/modules/search/application/search-service";
import styles from "@/modules/search/ui/search-results.module.css";
import { formatBusinessDate } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireUser();
  const query = (await searchParams).q?.trim() ?? "";
  const results = await globalSearch(query, session.user.role);
  const total = Object.values(results).reduce(
    (sum, group) => sum + group.length,
    0,
  );
  return (
    <Page className={styles.page} size="wide">
      <PageHeader
        eyebrow="Búsqueda global"
        title={
          query.length >= 2
            ? `Resultados para “${query}”`
            : "Encontrá cualquier registro"
        }
        description={
          query.length >= 2
            ? `${total} resultado(s) dentro de tu nivel de acceso.`
            : "Escribí al menos dos caracteres en el buscador superior."
        }
      />
      {query.length >= 2 && total === 0 ? (
        <div className="inline-empty">
          <strong>No encontramos coincidencias</strong>
          <p>Probá con cliente, vehículo, servicio o referencia.</p>
        </div>
      ) : null}
      <div className={styles.groups}>
        {results.clients.length ? (
          <section className={styles.group}>
            <h2>Clientes</h2>
            {results.clients.map((client) => (
              <Link href={`/app/clients/${client.id}`} key={client.id}>
                <strong>{client.displayName}</strong>
                <small>
                  {client.phone || (client.active ? "Activo" : "Archivado")}
                </small>
              </Link>
            ))}
          </section>
        ) : null}
        {results.vehicles.length ? (
          <section className={styles.group}>
            <h2>Vehículos</h2>
            {results.vehicles.map((vehicle) => (
              <Link href={`/app/clients/${vehicle.clientId}`} key={vehicle.id}>
                <strong>
                  {vehicle.brand} {vehicle.model}
                </strong>
                <small>
                  {vehicle.client.displayName}
                  {vehicle.year ? ` · ${vehicle.year}` : ""}
                </small>
              </Link>
            ))}
          </section>
        ) : null}
        {results.jobs.length ? (
          <section className={styles.group}>
            <h2>Trabajos</h2>
            {results.jobs.map((job) => (
              <Link href={`/app/jobs/${job.id}`} key={job.id}>
                <strong>
                  {job.serviceCase.vehicle.brand}{" "}
                  {job.serviceCase.vehicle.model}
                </strong>
                <small>
                  {job.serviceCase.client.displayName} ·{" "}
                  {formatBusinessDate(job.performedAt)}
                </small>
              </Link>
            ))}
          </section>
        ) : null}
        {results.services.length ? (
          <section className={styles.group}>
            <h2>Servicios</h2>
            {results.services.map((service) => (
              <Link
                href={
                  session.user.role === "ADMIN"
                    ? `/app/services/${service.id}`
                    : "/app/calendar/new"
                }
                key={service.id}
              >
                <strong>{service.name}</strong>
                <small>
                  {service.category.name}
                  {service.estimatedDurationMinutes
                    ? ` · ${service.estimatedDurationMinutes} min`
                    : ""}
                </small>
              </Link>
            ))}
          </section>
        ) : null}
        {results.quotes.length ? (
          <section className={styles.group}>
            <h2>Presupuestos</h2>
            {results.quotes.map((quote) => (
              <Link href={`/app/quotes/${quote.id}`} key={quote.id}>
                <strong>{quote.number}</strong>
                <small>
                  {quote.client.displayName} · {quote.vehicle.brand}{" "}
                  {quote.vehicle.model}
                </small>
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </Page>
  );
}
