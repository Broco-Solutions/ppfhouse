import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  getAppointmentDetail,
  listSchedulingOptions,
} from "@/modules/scheduling/application/scheduling-service";
import { AppointmentForm } from "@/modules/scheduling/ui/appointment-form";
import styles from "@/modules/scheduling/ui/calendar.module.css";
import { formatBusinessDateTimeInput } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Editar turno" };

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  await requireRole("ADMIN", "STAFF");
  const { appointmentId } = await params;
  const appointment = await getAppointmentDetail(appointmentId);
  if (!appointment) notFound();
  if (appointment.status !== "CONFIRMED")
    redirect(`/app/calendar/${appointment.id}`);
  const options = await listSchedulingOptions(
    appointment.serviceCase.clientId,
    appointment.serviceCase.vehicleId,
  );
  const vehicle = appointment.serviceCase.vehicle;

  return (
    <div className={styles.formPageWide}>
      <Link
        className={styles.backLink}
        href={`/app/calendar/${appointment.id}`}
      >
        ← Volver al turno
      </Link>
      <header className={styles.formHero}>
        <div>
          <p className={styles.eyebrow}>
            {appointment.serviceCase.client.displayName}
          </p>
          <h1>Editar turno</h1>
          <p className={styles.description}>
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
      </header>
      <AppointmentForm
        options={options}
        values={{
          id: appointment.id,
          clientId: appointment.serviceCase.clientId,
          vehicleId: appointment.serviceCase.vehicleId,
          clientLabel: appointment.serviceCase.client.displayName,
          vehicleLabel: `${vehicle.brand} ${vehicle.model}`,
          startLocal: formatBusinessDateTimeInput(appointment.startAt),
          endLocal: formatBusinessDateTimeInput(appointment.endAt),
          serviceIds: appointment.services
            .map((service) => service.serviceId)
            .filter((id): id is string => Boolean(id)),
          employeeIds: appointment.employees.map((employee) => employee.userId),
          internalNotes: appointment.internalNotes,
          visibleToClient: appointment.visibleToClient,
          color: appointment.color,
        }}
        identityReassignment={appointment.identityReassignment}
      />
    </div>
  );
}
