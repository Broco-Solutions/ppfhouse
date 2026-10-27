"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addJobConsumption,
  correctJobConsumption,
  reverseJobConsumption,
} from "@/modules/job-consumptions/application/consumption-service";
import { requireRole } from "@/modules/identity/application/authorization";

export interface ConsumptionFormState {
  status: "idle" | "error";
  message?: string;
}

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "INSUFFICIENT_STOCK")
    return "No hay stock suficiente para registrar esa cantidad.";
  if (message === "INVENTORY_ITEM_NOT_AVAILABLE")
    return "El insumo seleccionado ya no está disponible.";
  if (message === "JOB_NOT_AVAILABLE")
    return "El trabajo está anulado y no admite nuevos consumos.";
  if (message === "CONSUMPTION_NOT_ACTIVE")
    return "Ese consumo ya fue corregido o anulado.";
  if (message === "IDEMPOTENCY_CONFLICT")
    return "El formulario cambió después del primer intento. Recargalo para continuar.";
  return "No pudimos registrar el consumo. Revisá los datos e intentá nuevamente.";
}

export async function addConsumptionAction(
  _state: ConsumptionFormState,
  formData: FormData,
): Promise<ConsumptionFormState> {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  try {
    await addJobConsumption(
      {
        jobId,
        itemId: value(formData, "itemId"),
        quantityBase: value(formData, "quantityBase"),
        note: value(formData, "note"),
        idempotencyKey: value(formData, "idempotencyKey"),
      },
      session.user,
    );
    revalidatePath("/app/inventory");
    revalidatePath(`/app/jobs/${jobId}`);
    redirect(`/app/jobs/${jobId}?consumed=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: messageFor(error) };
  }
}

export async function correctConsumptionAction(
  _state: ConsumptionFormState,
  formData: FormData,
): Promise<ConsumptionFormState> {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  try {
    await correctJobConsumption(
      {
        consumptionId: value(formData, "consumptionId"),
        quantityBase: value(formData, "quantityBase"),
        reason: value(formData, "reason"),
        idempotencyKey: value(formData, "idempotencyKey"),
      },
      session.user,
    );
    revalidatePath("/app/inventory");
    revalidatePath(`/app/jobs/${jobId}`);
    redirect(`/app/jobs/${jobId}?corrected=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: messageFor(error) };
  }
}

export async function reverseConsumptionAction(formData: FormData) {
  const session = await requireRole("ADMIN", "STAFF");
  const jobId = value(formData, "jobId");
  await reverseJobConsumption(
    {
      consumptionId: value(formData, "consumptionId"),
      reason: value(formData, "reason"),
    },
    session.user,
  );
  revalidatePath("/app/inventory");
  revalidatePath(`/app/jobs/${jobId}`);
  redirect(`/app/jobs/${jobId}?consumptionReversed=1`);
}
