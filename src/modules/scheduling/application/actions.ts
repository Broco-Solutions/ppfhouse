"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/modules/identity/application/session";
import {
  cancelAppointment,
  cancelCalendarBlock,
  createAppointment,
  createCalendarBlock,
  updateAppointment,
} from "@/modules/scheduling/application/scheduling-service";
import {
  type AppointmentTone,
  isAppointmentTone,
} from "@/modules/scheduling/domain/appointment-tones";

export interface SchedulingFormState {
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

function friendlyError(error: unknown) {
  const text = error instanceof Error ? error.message : "";
  if (text.startsWith("CALENDAR_BLOCKED:"))
    return `Ese horario está bloqueado: ${text.split(":").slice(1).join(":")}.`;
  if (text === "INVALID_APPOINTMENT_RANGE")
    return "La finalización debe ser posterior al inicio.";
  if (text === "VEHICLE_CLIENT_MISMATCH")
    return "El vehículo no pertenece al cliente seleccionado.";
  if (text === "APPOINTMENT_IDENTITY_LOCKED")
    return "Este turno ya tiene información comercial o histórica y no permite cambiar cliente o vehículo.";
  if (text === "SERVICE_NOT_AVAILABLE")
    return "Uno de los servicios ya no está disponible.";
  if (text === "IDEMPOTENCY_CONFLICT")
    return "Este intento ya fue usado con otros datos. Recargá el formulario.";
  return "No pudimos guardar. Revisá los datos e intentá nuevamente.";
}

export async function saveAppointmentAction(
  _state: SchedulingFormState,
  formData: FormData,
): Promise<SchedulingFormState> {
  const session = await requireUser();
  const id = value(formData, "id");
  const shared = {
    clientId: value(formData, "clientId"),
    vehicleId: value(formData, "vehicleId"),
    startLocal: value(formData, "startLocal"),
    endLocal: value(formData, "endLocal"),
    serviceIds: values(formData, "serviceIds"),
    employeeIds: values(formData, "employeeIds"),
    internalNotes: value(formData, "internalNotes"),
    visibleToClient: value(formData, "visibleToClient") === "on",
    color: isAppointmentTone(value(formData, "color"))
      ? (value(formData, "color") as AppointmentTone)
      : null,
  };
  try {
    const appointment = id
      ? await updateAppointment(id, shared, session.user)
      : await createAppointment(
          {
            ...shared,
            idempotencyKey: value(formData, "idempotencyKey"),
          },
          session.user,
        );
    revalidatePath("/app/calendar");
    revalidatePath(`/app/calendar/${appointment.id}`);
    redirect(`/app/calendar/${appointment.id}?${id ? "saved" : "created"}=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: friendlyError(error) };
  }
}

export async function cancelAppointmentAction(formData: FormData) {
  const session = await requireUser();
  const id = value(formData, "id");
  await cancelAppointment(id, session.user);
  revalidatePath("/app/calendar");
  revalidatePath(`/app/calendar/${id}`);
  redirect(`/app/calendar/${id}?cancelled=1`);
}

export async function saveCalendarBlockAction(
  _state: SchedulingFormState,
  formData: FormData,
): Promise<SchedulingFormState> {
  const session = await requireUser();
  try {
    await createCalendarBlock(
      {
        reason: value(formData, "reason"),
        startLocal: value(formData, "startLocal"),
        endLocal: value(formData, "endLocal"),
        allDay: value(formData, "allDay") === "on",
        notes: value(formData, "notes"),
      },
      session.user,
    );
    revalidatePath("/app/calendar");
    redirect("/app/calendar?blockSaved=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: friendlyError(error) };
  }
}

export async function cancelCalendarBlockAction(formData: FormData) {
  const session = await requireUser();
  await cancelCalendarBlock(value(formData, "id"), session.user);
  revalidatePath("/app/calendar");
}
