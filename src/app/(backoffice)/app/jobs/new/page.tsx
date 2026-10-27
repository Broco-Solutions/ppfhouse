import type { Metadata } from "next";
import Link from "next/link";

import { Page, PageHeader } from "@/components/patterns/page";
import { listJobOptions } from "@/modules/jobs/application/job-service";
import { JobForm } from "@/modules/jobs/ui/job-form";
import styles from "@/modules/jobs/ui/jobs.module.css";
import { formatBusinessDateTimeInput } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Nuevo trabajo" };

export default async function NewJobPage() {
  const options = await listJobOptions();
  return (
    <Page className={styles.page} size="narrow">
      <Link href="/app/jobs" className="back-link">
        ← Trabajos
      </Link>
      <PageHeader
        eyebrow="Registro directo"
        title="Nuevo trabajo"
        description="Documentá lo efectivamente realizado sin turno previo. El registro no genera un cobro automático."
      />
      {options.clients.length ? (
        <JobForm
          options={options}
          idempotencyKey={crypto.randomUUID()}
          values={{ performedLocal: formatBusinessDateTimeInput(new Date()) }}
        />
      ) : (
        <section className="empty-state">
          <h2>Primero necesitás un cliente con vehículo.</h2>
          <p>Después podrás registrar el trabajo en menos de un minuto.</p>
          <Link href="/app/clients/new" className="ghost-button button-link">
            Crear cliente
          </Link>
        </section>
      )}
    </Page>
  );
}
