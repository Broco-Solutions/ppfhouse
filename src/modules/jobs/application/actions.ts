"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  completeAppointment,
  createDirectJob,
  voidJob,
} from "@/modules/jobs/application/job-service";
import { requireUser } from "@/modules/identity/application/session";

export interface JobFormState {
  status: "idle" | "error";
  message?: string;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function values(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((item): item is string => typeof item === "string");
}

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "APPOINTMENT_NOT_COMPLETABLE")
    return "Este turno ya no puede marcarse como realizado.";
  if (message === "VEHICLE_CLIENT_MISMATCH")
    return "El vehículo no pertenece al cliente seleccionado.";
  if (message === "SERVICE_NOT_AVAILABLE")
    return "Uno de los servicios seleccionados ya no está disponible.";
  if (message === "IDEMPOTENCY_CONFLICT")
    return "El formulario cambió después del primer intento. Recargalo para continuar.";
  return "No pudimos guardar el trabajo. Revisá los datos e intentá nuevamente.";
}

export async function saveJobAction(
  _state: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const session = await requireUser();
  const appointmentId = value(formData, "appointmentId");
  const shared = {
    performedLocal: value(formData, "performedLocal"),
    serviceIds: values(formData, "serviceIds"),
    employeeIds: values(formData, "employeeIds"),
    notes: value(formData, "notes"),
  };
  try {
    const job = appointmentId
      ? await completeAppointment({ appointmentId, ...shared }, session.user)
      : await createDirectJob(
          {
            clientId: value(formData, "clientId"),
            vehicleId: value(formData, "vehicleId"),
            idempotencyKey: value(formData, "idempotencyKey"),
            ...shared,
          },
          session.user,
        );
    revalidatePath("/app/jobs");
    revalidatePath("/app/calendar");
    if (appointmentId) revalidatePath(`/app/calendar/${appointmentId}`);
    redirect(`/app/jobs/${job.id}?saved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: messageFor(error) };
  }
}

export async function voidJobAction(formData: FormData) {
  const session = await requireUser();
  const jobId = value(formData, "jobId");
  await voidJob({ jobId, reason: value(formData, "reason") }, session.user);
  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${jobId}`);
  redirect(`/app/jobs/${jobId}?voided=1`);
}
