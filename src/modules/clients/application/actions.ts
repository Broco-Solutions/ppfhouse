"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  archiveClient,
  createClient,
  createVehicle,
  findPossibleDuplicates,
  restoreClient,
  setVehicleArchived,
  updateClient,
  updateVehicle,
} from "@/modules/clients/application/client-service";
import {
  clientInputSchema,
  vehicleInputSchema,
} from "@/modules/clients/domain/client-schema";
import { requireUser } from "@/modules/identity/application/session";

export interface FormActionState {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string>;
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function validationState(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}) {
  return {
    status: "error" as const,
    message: "Revisá los campos marcados.",
    fields: Object.fromEntries(
      error.issues.map((issue) => [String(issue.path[0]), issue.message]),
    ),
  };
}

export async function saveClientAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const session = await requireUser();
  const parsed = clientInputSchema.safeParse({
    displayName: stringValue(formData, "displayName"),
    firstName: stringValue(formData, "firstName"),
    lastName: stringValue(formData, "lastName"),
    phone: stringValue(formData, "phone"),
    whatsapp: stringValue(formData, "whatsapp"),
    email: stringValue(formData, "email"),
    instagram: stringValue(formData, "instagram"),
    notes: stringValue(formData, "notes"),
  });
  if (!parsed.success) return validationState(parsed.error);

  const id = stringValue(formData, "id");
  try {
    const duplicates = await findPossibleDuplicates({
      phone: parsed.data.phone,
      email: parsed.data.email,
      excludeId: id || undefined,
    });
    const client = id
      ? await updateClient(id, parsed.data, session.user)
      : await createClient(parsed.data, session.user);
    revalidatePath("/app/clients");
    redirect(
      `/app/clients/${client.id}?saved=1${duplicates.length ? `&possibleDuplicates=${duplicates.length}` : ""}`,
    );
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      status: "error",
      message: "No pudimos guardar el cliente. Intentá nuevamente.",
    };
  }
}

export async function saveVehicleAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const session = await requireUser();
  const clientId = stringValue(formData, "clientId");
  const vehicleId = stringValue(formData, "vehicleId");
  const parsed = vehicleInputSchema.safeParse({
    brand: stringValue(formData, "brand"),
    model: stringValue(formData, "model"),
    version: formData.has("version")
      ? stringValue(formData, "version")
      : undefined,
    year: formData.has("year") ? stringValue(formData, "year") : undefined,
    color: formData.has("color") ? stringValue(formData, "color") : undefined,
    vehicleClass: formData.has("vehicleClass")
      ? stringValue(formData, "vehicleClass")
      : undefined,
    notes: formData.has("notes") ? stringValue(formData, "notes") : undefined,
  });
  if (!clientId)
    return { status: "error", message: "Falta identificar el cliente." };
  if (!parsed.success) return validationState(parsed.error);

  try {
    if (vehicleId) {
      await updateVehicle(clientId, vehicleId, parsed.data, session.user);
    } else {
      await createVehicle(clientId, parsed.data, session.user);
    }
    revalidatePath(`/app/clients/${clientId}`);
    redirect(`/app/clients/${clientId}?vehicleSaved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      status: "error",
      message: "No pudimos guardar el vehículo. Intentá nuevamente.",
    };
  }
}

export async function setClientArchivedAction(formData: FormData) {
  const session = await requireUser();
  const id = stringValue(formData, "id");
  const archived = stringValue(formData, "archived") === "true";
  if (!id) return;
  if (archived) await archiveClient(id, session.user);
  else await restoreClient(id, session.user);
  revalidatePath("/app/clients");
  revalidatePath(`/app/clients/${id}`);
  redirect(`/app/clients/${id}?statusChanged=1`);
}

export async function setVehicleArchivedAction(formData: FormData) {
  const session = await requireUser();
  const clientId = stringValue(formData, "clientId");
  const vehicleId = stringValue(formData, "vehicleId");
  const archived = stringValue(formData, "archived") === "true";
  if (!clientId || !vehicleId) return;
  await setVehicleArchived(clientId, vehicleId, archived, session.user);
  revalidatePath(`/app/clients/${clientId}`);
}
