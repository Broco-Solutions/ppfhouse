import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/brand/brand-assets";
import { brandConfig } from "@/config/brand";
import {
  getPortalProjection,
  resolvePortalLink,
} from "@/modules/portal/application/portal-service";
import { getPortalSession } from "@/modules/portal/application/portal-session";
import { PortalGallery } from "@/modules/portal/ui/portal-gallery";
import { PortalUnlockForm } from "@/modules/portal/ui/portal-unlock-form";
import styles from "@/modules/portal/ui/portal.module.css";
import {
  formatBusinessDate,
  formatBusinessDateTime,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = {
  title: `Mi vehículo · ${brandConfig.shortName}`,
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

function PortalFrame({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <BrandLockup className={styles.lockup} priority />
        <span className={styles.privateLabel}>Espacio privado</span>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>{brandConfig.businessName}</span>
        <small>Detalle, protección y cuidado.</small>
      </footer>
    </main>
  );
}

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await resolvePortalLink(token);
  if (!link) {
    return (
      <PortalFrame>
        <section className={styles.access}>
          <p className={styles.eyebrow}>Acceso privado</p>
          <h1>Este link ya no está disponible.</h1>
          <p>
            Pedile a Ferraro un nuevo acceso si necesitás consultar tu
            historial.
          </p>
        </section>
      </PortalFrame>
    );
  }

  const session = await getPortalSession();
  const sessionMatches = session?.id === link.id;
  if (!sessionMatches && !link.passwordHash)
    redirect(`/api/client/access/${token}`);

  if (!sessionMatches) {
    return (
      <PortalFrame>
        <section className={styles.access}>
          <p className={styles.eyebrow}>Acceso privado</p>
          <h1>Tu historial Ferraro.</h1>
          <p>Ingresá la contraseña que recibiste junto con este link.</p>
          <PortalUnlockForm token={token} />
        </section>
      </PortalFrame>
    );
  }

  const portal = await getPortalProjection(link.clientId);
  if (!portal) return null;

  return (
    <PortalFrame>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Espacio privado</p>
        <h1>Hola, {portal.displayName}.</h1>
        <p>Tu garage y el trabajo realizado por Ferraro, en un solo lugar.</p>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Garage</p>
            <h2>Tus vehículos</h2>
          </div>
          <span className={styles.count}>{portal.vehicles.length}</span>
        </div>
        <div className={styles.vehicles}>
          {portal.vehicles.map((vehicle) => (
            <article className={styles.vehicle} key={vehicle.id}>
              <div>
                <h3>
                  {vehicle.brand} {vehicle.model}
                </h3>
                <p>
                  {[vehicle.version, vehicle.year, vehicle.color]
                    .filter(Boolean)
                    .join(" · ") || "Cuidado por Ferraro"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Próximamente</p>
            <h2>Próximos turnos</h2>
          </div>
          <span className={styles.count}>{portal.appointments.length}</span>
        </div>
        {portal.appointments.length ? (
          <div className={styles.appointments}>
            {portal.appointments.map((appointment) => (
              <article className={styles.appointment} key={appointment.id}>
                <time>{formatBusinessDateTime(appointment.startAt)}</time>
                <strong>
                  {appointment.serviceCase.vehicle.brand}{" "}
                  {appointment.serviceCase.vehicle.model}
                </strong>
                <p>
                  {appointment.services
                    .map((service) => service.nameSnapshot)
                    .join(" · ") || "Visita agendada"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <strong>Sin próximos turnos</strong>
            <p>Cuando coordinemos una nueva visita, aparecerá acá.</p>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Historial</p>
            <h2>Trabajos realizados</h2>
          </div>
          <span className={styles.count}>{portal.jobs.length}</span>
        </div>
        {portal.jobs.length ? (
          <div className={styles.jobs}>
            {portal.jobs.map((job) => (
              <article className={styles.job} key={job.id}>
                <header className={styles.jobHeader}>
                  <div>
                    <time>{formatBusinessDate(job.performedAt)}</time>
                    <h3>
                      {job.serviceCase.vehicle.brand}{" "}
                      {job.serviceCase.vehicle.model}
                    </h3>
                  </div>
                  <span>{job.photos.length} fotos</span>
                </header>
                <ul className={styles.services}>
                  {job.services.length ? (
                    job.services.map((service) => (
                      <li key={service.id}>
                        <strong>{service.nameSnapshot}</strong>
                        {service.descriptionSnapshot ? (
                          <p>{service.descriptionSnapshot}</p>
                        ) : null}
                      </li>
                    ))
                  ) : (
                    <li>Trabajo documentado por Ferraro</li>
                  )}
                </ul>
                {job.photos.length ? (
                  <PortalGallery photos={job.photos} />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <strong>Tu historial comienza acá</strong>
            <p>Los trabajos realizados aparecerán en este espacio.</p>
          </div>
        )}
      </section>
    </PortalFrame>
  );
}
