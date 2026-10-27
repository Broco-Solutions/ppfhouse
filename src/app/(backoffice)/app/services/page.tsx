import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import {
  ClockIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { requireRole } from "@/modules/identity/application/authorization";
import { toggleServiceAction } from "@/modules/services/application/actions";
import { listAdminCatalog } from "@/modules/services/application/service-catalog";
import { CategoryForm } from "@/modules/services/ui/catalog-forms";
import styles from "@/modules/services/ui/services.module.css";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ categorySaved?: string }>;
}) {
  await requireRole("ADMIN");
  const [catalog, notice] = await Promise.all([
    listAdminCatalog(),
    searchParams,
  ]);
  const count = catalog.reduce(
    (total, category) => total + category.services.length,
    0,
  );

  return (
    <Page className={styles.page}>
      <PageHeader
        actions={
          <Link
            className={`${buttonClassName("primary")} ${styles.headerLink}`}
            href="/app/services/new"
          >
            <PlusIcon aria-hidden size={18} weight="bold" />
            <span>Nuevo servicio</span>
          </Link>
        }
        description="Precios sugeridos configurables, duración visible y excepciones explícitas."
        eyebrow="Catálogo comercial"
        title="Servicios"
      />
      {notice.categorySaved ? (
        <p className={styles.notice} role="status">
          Categoría creada.
        </p>
      ) : null}

      <CategoryForm />

      <div className={styles.resultsMeta}>
        <strong>{count}</strong>
        <span>{count === 1 ? "servicio" : "servicios"}</span>
      </div>

      {catalog.length ? (
        <div className={styles.catalog}>
          {catalog.map((category) => (
            <section className={styles.category} key={category.id}>
              <header className={styles.categoryHeader}>
                <div>
                  <p className={styles.eyebrow}>Categoría</p>
                  <h2>{category.name}</h2>
                </div>
                <div className="header-actions">
                  <span
                    aria-label={`${category.services.length} servicios`}
                    className={styles.count}
                  >
                    {category.services.length}
                  </span>
                  <DeleteRecordLink kind="serviceCategory" id={category.id} />
                </div>
              </header>
              {category.services.length ? (
                <div className={styles.serviceList}>
                  {category.services.map((service) => (
                    <article
                      className={`${styles.serviceRow} ${
                        service.active ? "" : styles.archived
                      }`}
                      key={service.id}
                    >
                      <div className={styles.serviceIdentity}>
                        <strong>{service.name}</strong>
                        <small>
                          {service.internalDescription ||
                            service.commercialDescription ||
                            "Sin descripción cargada"}
                        </small>
                      </div>
                      <div className={styles.serviceMeta}>
                        <span>
                          <ClockIcon aria-hidden size={16} />{" "}
                          {service.estimatedDurationMinutes
                            ? `${service.estimatedDurationMinutes} min`
                            : "Duración abierta"}
                        </span>
                        <span>
                          <SlidersHorizontalIcon aria-hidden size={16} />{" "}
                          {service.variants.length}{" "}
                          {service.variants.length === 1
                            ? "variante"
                            : "variantes"}
                        </span>
                      </div>
                      <strong className={styles.price}>
                        {service.basePriceUsd
                          ? `USD ${service.basePriceUsd.toFixed(2)}`
                          : "A cotizar"}
                      </strong>
                      <div className={styles.serviceActions}>
                        <Badge
                          intent={service.active ? "success" : "neutral"}
                          withIcon
                        >
                          {service.active ? "Activo" : "Inactivo"}
                        </Badge>
                        <Link
                          className={styles.textAction}
                          href={`/app/services/${service.id}`}
                        >
                          Configurar
                        </Link>
                        <form action={toggleServiceAction}>
                          <input name="id" type="hidden" value={service.id} />
                          <input
                            name="active"
                            type="hidden"
                            value={String(!service.active)}
                          />
                          <button className={styles.textAction} type="submit">
                            {service.active ? "Desactivar" : "Activar"}
                          </button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.inlineEmpty}>
                  <strong>Sin servicios en esta categoría</strong>
                  <p>Podés usarla al crear el próximo servicio.</p>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <WrenchIcon aria-hidden size={30} />
          <p className={styles.eyebrow}>Catálogo inicial</p>
          <h2>Creá una categoría para empezar.</h2>
          <p>
            Después vas a poder cargar servicios, precios base y variantes
            simples.
          </p>
        </section>
      )}
    </Page>
  );
}
