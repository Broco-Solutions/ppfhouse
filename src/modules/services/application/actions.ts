"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  createCategory,
  createService,
  createVariant,
  setServiceActive,
  setVariantActive,
  updateService,
} from "@/modules/services/application/service-catalog";
import {
  categoryInputSchema,
  serviceInputSchema,
  variantInputSchema,
} from "@/modules/services/domain/service-schema";

export interface CatalogFormState {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string>;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function invalid(error: {
  issues: readonly { path: PropertyKey[]; message: string }[];
}): CatalogFormState {
  return {
    status: "error",
    message: "Revisá los campos marcados.",
    fields: Object.fromEntries(
      error.issues.map((issue) => [String(issue.path[0]), issue.message]),
    ),
  };
}

export async function createCategoryAction(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const session = await requireRole("ADMIN");
  const parsed = categoryInputSchema.safeParse({
    name: value(formData, "name"),
    sortOrder: value(formData, "sortOrder") || 0,
  });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await createCategory(parsed.data, session.user);
    revalidatePath("/app/services");
    redirect("/app/services?categorySaved=1");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      status: "error",
      message: "No pudimos crear la categoría. Verificá que no exista.",
    };
  }
}

export async function saveServiceAction(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const session = await requireRole("ADMIN");
  const parsed = serviceInputSchema.safeParse({
    categoryId: value(formData, "categoryId"),
    name: value(formData, "name"),
    internalDescription: value(formData, "internalDescription"),
    commercialDescription: value(formData, "commercialDescription"),
    basePriceUsd: value(formData, "basePriceUsd"),
    estimatedDurationMinutes: value(formData, "estimatedDurationMinutes"),
    sortOrder: value(formData, "sortOrder") || 0,
  });
  if (!parsed.success) return invalid(parsed.error);
  const id = value(formData, "id");
  try {
    const service = id
      ? await updateService(id, parsed.data, session.user)
      : await createService(parsed.data, session.user);
    revalidatePath("/app/services");
    redirect(`/app/services/${service.id}?saved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      status: "error",
      message: "No pudimos guardar el servicio. Revisá categoría y nombre.",
    };
  }
}

export async function createVariantAction(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const session = await requireRole("ADMIN");
  const serviceId = value(formData, "serviceId");
  const parsed = variantInputSchema.safeParse({
    type: value(formData, "type"),
    label: value(formData, "label"),
    vehicleClass: value(formData, "vehicleClass"),
    matchBrand: value(formData, "matchBrand"),
    matchModel: value(formData, "matchModel"),
    priceUsd: value(formData, "priceUsd"),
    estimatedDurationMinutes: value(formData, "estimatedDurationMinutes"),
    priority: value(formData, "priority") || 0,
  });
  if (!parsed.success) return invalid(parsed.error);
  try {
    await createVariant(serviceId, parsed.data, session.user);
    revalidatePath(`/app/services/${serviceId}`);
    redirect(`/app/services/${serviceId}?variantSaved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: "No pudimos guardar la variante." };
  }
}

export async function toggleServiceAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const id = value(formData, "id");
  await setServiceActive(
    id,
    value(formData, "active") === "true",
    session.user,
  );
  revalidatePath("/app/services");
  revalidatePath(`/app/services/${id}`);
}

export async function toggleVariantAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const id = value(formData, "id");
  const serviceId = value(formData, "serviceId");
  await setVariantActive(
    id,
    serviceId,
    value(formData, "active") === "true",
    session.user,
  );
  revalidatePath(`/app/services/${serviceId}`);
}
