import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/modules/identity/application/authorization";
import {
  toggleServiceAction,
  toggleVariantAction,
} from "@/modules/services/application/actions";
import { getAdminService } from "@/modules/services/application/service-catalog";
import { ServiceForm, VariantForm } from "@/modules/services/ui/catalog-forms";
import styles from "@/modules/services/ui/services.module.css";

export const metadata: Metadata = { title: "Configurar servicio" };

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ saved?: string; variantSaved?: string }>;
}) {
  await requireRole("ADMIN");
  const [{ serviceId }, notices] = await Promise.all([params, searchParams]);
  const { service, categories } = await getAdminService(serviceId);
  if (!service) notFound();

  return (
    <Page className={styles.detailPage} size="narrow">
      <Link className={styles.backLink} href="/app/services">
        ← Servicios
      </Link>
      {notices.saved || notices.variantSaved ? (
        <p className={styles.notice} role="status">
          Los cambios se guardaron correctamente.
        </p>
      ) : null}
      <DetailHeader
        actions={
          <>
            <form action={toggleServiceAction}>
              <input name="id" type="hidden" value={service.id} />
              <input
                name="active"
                type="hidden"
                value={String(!service.active)}
              />
              <Button type="submit" variant="ghost">
                {service.active ? "Desactivar" : "Activar"}
              </Button>
            </form>
            <DeleteRecordLink kind="service" id={service.id} />
          </>
        }
        description={
          service.basePriceUsd
            ? `Base USD ${service.basePriceUsd.toFixed(2)} · ${
                service.estimatedDurationMinutes
                  ? `${service.estimatedDurationMinutes} min`
                  : "duración abierta"
              }`
            : "Servicio a cotizar"
        }
        eyebrow={service.category.name}
        title={service.name}
      />

      <ServiceForm
        categories={categories}
        values={{
          id: service.id,
          categoryId: service.categoryId,
          name: service.name,
          internalDescription: service.internalDescription,
          commercialDescription: service.commercialDescription,
          basePriceUsd: service.basePriceUsd?.toString(),
          estimatedDurationMinutes: service.estimatedDurationMinutes,
          sortOrder: service.sortOrder,
        }}
      />

      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Pricing simple</p>
            <h2>Variantes</h2>
          </div>
          <span
            aria-label={`${service.variants.length} variantes`}
            className={styles.count}
          >
            {service.variants.length}
          </span>
        </header>
        {service.variants.length ? (
          <div className={styles.variantList}>
            {service.variants.map((variant) => (
              <article
                className={`${styles.variantRow} ${
                  variant.active ? "" : styles.archived
                }`}
                key={variant.id}
              >
                <div className={styles.variantIdentity}>
                  <strong>{variant.label}</strong>
                  <small>
                    {variant.type === "VEHICLE_CLASS"
                      ? `Segmento ${variant.vehicleClass}`
                      : `${variant.matchBrand} ${variant.matchModel}`}{" "}
                    · prioridad {variant.priority}
                  </small>
                </div>
                <strong className={styles.variantPrice}>
                  USD {variant.priceUsd.toFixed(2)}
                </strong>
                <form action={toggleVariantAction}>
                  <input name="id" type="hidden" value={variant.id} />
                  <input name="serviceId" type="hidden" value={service.id} />
                  <input
                    name="active"
                    type="hidden"
                    value={String(!variant.active)}
                  />
                  <button className={styles.textAction} type="submit">
                    {variant.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.inlineEmpty}>
            <strong>Sin variantes</strong>
            <p>El sistema sugerirá el precio base o “a cotizar”.</p>
          </div>
        )}
        <details className={styles.disclosure}>
          <summary>Agregar variante</summary>
          <div className={styles.disclosureBody}>
            <VariantForm serviceId={service.id} />
          </div>
        </details>
      </section>
    </Page>
  );
}
