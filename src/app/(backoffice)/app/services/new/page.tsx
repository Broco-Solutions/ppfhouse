import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { requireRole } from "@/modules/identity/application/authorization";
import { listActiveCategories } from "@/modules/services/application/service-catalog";
import { ServiceForm } from "@/modules/services/ui/catalog-forms";
import styles from "@/modules/services/ui/services.module.css";

export const metadata: Metadata = { title: "Nuevo servicio" };

export default async function NewServicePage() {
  await requireRole("ADMIN");
  const categories = await listActiveCategories();
  return (
    <Page className={styles.formPage} size="narrow">
      <Link className={styles.backLink} href="/app/services">
        ← Servicios
      </Link>
      <PageHeader
        description="El precio puede quedar a cotizar. Nada se hardcodea."
        eyebrow="Catálogo"
        title="Nuevo servicio"
      />
      {categories.length ? (
        <ServiceForm categories={categories} />
      ) : (
        <section className={styles.empty}>
          <h2>Primero necesitás una categoría.</h2>
          <p>
            Volvé al catálogo y agregá una categoría como Protección o
            Detailing.
          </p>
          <Link className={styles.textAction} href="/app/services">
            Volver al catálogo
          </Link>
        </section>
      )}
    </Page>
  );
}
