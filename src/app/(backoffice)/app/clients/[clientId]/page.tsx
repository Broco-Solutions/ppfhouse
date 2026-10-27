import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import { CarProfileIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { Button, buttonClassName } from "@/components/ui/button";
import { Alert } from "@/components/ui/status";
import {
  setClientArchivedAction,
  setVehicleArchivedAction,
} from "@/modules/clients/application/actions";
import { getClientDetail } from "@/modules/clients/application/client-service";
import styles from "@/modules/clients/ui/clients.module.css";
import { VehicleForm } from "@/modules/clients/ui/vehicle-form";
import { requireUser } from "@/modules/identity/application/session";
import { listClientJobHistory } from "@/modules/jobs/application/job-service";
import { getClientShareLinkSummary } from "@/modules/portal/application/portal-service";
import { ShareLinkManager } from "@/modules/portal/ui/share-link-manager";
import { listClientQuotes } from "@/modules/quotes/application/quote-service";
import { formatBusinessDate } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Ficha de cliente" };

interface PageProps {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{
    saved?: string;
    possibleDuplicates?: string;
    vehicleSaved?: string;
    statusChanged?: string;
  }>;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { clientId } = await params;
  const notices = await searchParams;
  const session = await requireUser();
  const [client, jobs, quotes, shareLink] = await Promise.all([
    getClientDetail(clientId),
    listClientJobHistory(clientId),
    session.user.role === "ADMIN"
      ? listClientQuotes(clientId)
      : Promise.resolve([]),
    session.user.role === "ADMIN"
      ? getClientShareLinkSummary(clientId)
      : Promise.resolve(null),
  ]);
  if (!client) notFound();

  return (
    <Page className={styles.detailPage}>
      <Link className={styles.backLink} href="/app/clients">
        ← Clientes
      </Link>

      {notices.saved || notices.vehicleSaved || notices.statusChanged ? (
        <Alert intent="success" title="Cambios guardados">
          La ficha conserva la última información confirmada.
        </Alert>
      ) : null}
      {notices.possibleDuplicates ? (
        <Alert intent="warning" title="Posibles duplicados">
          Encontramos {notices.possibleDuplicates} cliente(s) con teléfono o
          email similar. Revisá la lista antes de continuar.
        </Alert>
      ) : null}

      <DetailHeader
        actions={
          <div className={styles.detailActions}>
            <Link
              className={`${buttonClassName("secondary")} ${styles.actionLink}`}
              href={`/app/clients/${client.id}/edit`}
            >
              Editar
            </Link>
            <form action={setClientArchivedAction}>
              <input name="id" type="hidden" value={client.id} />
              <input
                name="archived"
                type="hidden"
                value={String(client.active)}
              />
              <Button type="submit" variant="ghost">
                {client.active ? "Archivar" : "Restaurar"}
              </Button>
            </form>
            <DeleteRecordLink kind="client" id={client.id} />
          </div>
        }
        description={
          [client.phone, client.email, client.instagram]
            .filter(Boolean)
            .join(" · ") || "Sin datos de contacto cargados"
        }
        eyebrow={client.active ? "Cliente activo" : "Cliente archivado"}
        title={client.displayName}
      />

      <dl className={styles.detailSummary}>
        <div>
          <dt>Estado</dt>
          <dd>{client.active ? "Activo" : "Archivado"}</dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{client.whatsapp || "Sin cargar"}</dd>
        </div>
        <div>
          <dt>Alta</dt>
          <dd>
            {new Intl.DateTimeFormat("es-AR", {
              dateStyle: "medium",
              timeZone: "America/Argentina/Buenos_Aires",
            }).format(client.createdAt)}
          </dd>
        </div>
      </dl>

      {client.notes ? (
        <section className={styles.notes}>
          <div>
            <p className={styles.eyebrow}>Notas internas</p>
            <h2>Contexto</h2>
          </div>
          <p>{client.notes}</p>
        </section>
      ) : null}

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Garage</p>
            <h2>Vehículos</h2>
          </div>
          <span
            aria-label={`${client.vehicles.length} vehículos`}
            className={styles.count}
          >
            {client.vehicles.length}
          </span>
        </header>
        {client.vehicles.length ? (
          <div className={styles.vehicleList}>
            {client.vehicles.map((vehicle) => (
              <article
                className={`${styles.vehicle} ${vehicle.active ? "" : styles.vehicleArchived}`}
                key={vehicle.id}
              >
                <div className={styles.vehicleIdentity}>
                  <p className={styles.eyebrow}>
                    {vehicle.active ? "Activo" : "Archivado"}
                  </p>
                  <h3>
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  <p>{vehicle.version || "Versión sin especificar"}</p>
                </div>
                <div className={styles.vehicleMeta}>
                  <span>
                    <CarProfileIcon aria-hidden size={18} />{" "}
                    {[vehicle.year, vehicle.color]
                      .filter(Boolean)
                      .join(" · ") || "Sin detalles adicionales"}
                  </span>
                  <span>
                    {vehicle.vehicleClass
                      ? `Segmento ${vehicle.vehicleClass}`
                      : "Segmento sin definir"}
                  </span>
                </div>
                <div className={styles.vehicleActions}>
                  <Link
                    className={styles.textAction}
                    href={`/app/clients/${client.id}/vehicles/${vehicle.id}/edit`}
                  >
                    Editar
                  </Link>
                  <form action={setVehicleArchivedAction}>
                    <input name="clientId" type="hidden" value={client.id} />
                    <input name="vehicleId" type="hidden" value={vehicle.id} />
                    <input
                      name="archived"
                      type="hidden"
                      value={String(vehicle.active)}
                    />
                    <button className={styles.textAction} type="submit">
                      {vehicle.active ? "Archivar" : "Restaurar"}
                    </button>
                  </form>
                  <DeleteRecordLink kind="vehicle" id={vehicle.id} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.inlineEmpty}>
            <strong>Sin vehículos todavía</strong>
            <p>Agregá el primero sin salir de esta ficha.</p>
          </div>
        )}
      </section>

      <details className={styles.disclosure} open={!client.vehicles.length}>
        <summary>Agregar vehículo</summary>
        <div className={styles.disclosureBody}>
          <VehicleForm clientId={client.id} />
        </div>
      </details>

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Historial</p>
            <h2>Trabajos realizados</h2>
          </div>
          <span aria-label={`${jobs.length} trabajos`} className={styles.count}>
            {jobs.length}
          </span>
        </header>
        {jobs.length ? (
          <div className={styles.timeline}>
            {jobs.map((job) => (
              <Link
                className={styles.timelineItem}
                href={`/app/jobs/${job.id}`}
                key={job.id}
              >
                <time dateTime={job.performedAt.toISOString()}>
                  {formatBusinessDate(job.performedAt)}
                </time>
                <strong>
                  {job.serviceCase.vehicle.brand}{" "}
                  {job.serviceCase.vehicle.model}
                </strong>
                <small>
                  {job.services.map((item) => item.nameSnapshot).join(" · ") ||
                    "Sin servicios detallados"}
                </small>
                {job.voidedAt ? <em>Anulado</em> : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.inlineEmpty}>
            <strong>Sin trabajos todavía</strong>
            <p>El historial real aparecerá cuando se complete el primero.</p>
          </div>
        )}
      </section>

      {session.user.role === "ADMIN" ? (
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Comercial</p>
              <h2>Presupuestos</h2>
            </div>
            <span
              aria-label={`${quotes.length} presupuestos`}
              className={styles.count}
            >
              {quotes.length}
            </span>
          </header>
          {quotes.length ? (
            <div className={styles.timeline}>
              {quotes.map((quote) => (
                <Link
                  className={styles.timelineItem}
                  href={`/app/quotes/${quote.id}`}
                  key={quote.id}
                >
                  <time dateTime={quote.issuedOn.toISOString()}>
                    {formatBusinessDate(quote.issuedOn, { timeZone: "UTC" })}
                  </time>
                  <strong>{quote.number}</strong>
                  <small>
                    {quote.vehicle.brand} {quote.vehicle.model} · USD{" "}
                    {quote.totalUsd.toFixed(2)}
                  </small>
                  <em>{quote.status}</em>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.inlineEmpty}>
              <strong>Sin presupuestos</strong>
              <p>Podés crear el primero desde el módulo comercial.</p>
            </div>
          )}
        </section>
      ) : null}

      {session.user.role === "ADMIN" ? (
        <ShareLinkManager clientId={client.id} initialLink={shareLink} />
      ) : null}
    </Page>
  );
}
