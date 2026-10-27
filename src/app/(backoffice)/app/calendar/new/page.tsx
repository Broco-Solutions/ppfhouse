import type { Metadata } from "next";
import Link from "next/link";

import { listSchedulingOptions } from "@/modules/scheduling/application/scheduling-service";
import { AppointmentForm } from "@/modules/scheduling/ui/appointment-form";
import styles from "@/modules/scheduling/ui/calendar.module.css";
import { getBusinessDateKey } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Nuevo turno" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : getBusinessDateKey(new Date());
  const options = await listSchedulingOptions();
  return (
    <div className={styles.formPageWide}>
      <Link
        className={styles.backLink}
        href={`/app/calendar?view=day&date=${date}`}
      >
        ← Agenda
      </Link>
      <header className={styles.formHero}>
        <div>
          <p className={styles.eyebrow}>Alta rápida</p>
          <h1>Nuevo turno</h1>
          <p className={styles.description}>
            No requiere pago ni importe acordado.
          </p>
        </div>
      </header>
      <AppointmentForm
        options={options}
        idempotencyKey={crypto.randomUUID()}
        values={{ startLocal: `${date}T09:00`, endLocal: `${date}T13:00` }}
      />
    </div>
  );
}
