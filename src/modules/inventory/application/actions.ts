"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  adjustInventory,
  createInventoryCategory,
  createPurchasePresentation,
  reverseInventoryMovement,
  saveInventoryItem,
  setInventoryCategoryActive,
  setInventoryItemActive,
  setPurchasePresentationActive,
} from "@/modules/inventory/application/inventory-service";
import { requireRole } from "@/modules/identity/application/authorization";

export interface InventoryFormState {
  status: "idle" | "error";
  message?: string;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function inventoryMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "BASE_UNIT_LOCKED")
    return "La unidad base queda bloqueada después del primer movimiento.";
  if (message === "INSUFFICIENT_STOCK")
    return "El ajuste dejaría stock negativo. Revisá la cantidad o habilitá la excepción administrativa.";
  if (message === "IDEMPOTENCY_CONFLICT")
    return "Los datos cambiaron después del primer intento. Recargá el formulario.";
  if (message === "INVENTORY_CATEGORY_NOT_AVAILABLE")
    return "La categoría elegida ya no está disponible.";
  return "No pudimos guardar el cambio. Revisá los datos e intentá nuevamente.";
}

export async function saveInventoryItemAction(
  _state: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const session = await requireRole("ADMIN");
  try {
    const result = await saveInventoryItem(
      value(formData, "itemId") || undefined,
      {
        categoryId: value(formData, "categoryId"),
        name: value(formData, "name"),
        sku: value(formData, "sku"),
        baseUnit: value(formData, "baseUnit") as
          | "unit"
          | "meter"
          | "milliliter"
          | "gram"
          | "kilogram"
          | "liter"
          | "pair"
          | "sheet",
        minimumStock: value(formData, "minimumStock"),
        costHintUsd: value(formData, "costHintUsd"),
        notes: value(formData, "notes"),
      },
      session.user,
    );
    revalidatePath("/app/inventory");
    redirect(`/app/inventory/${result.id}?saved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: inventoryMessage(error) };
  }
}

export async function adjustInventoryAction(
  _state: InventoryFormState,
  formData: FormData,
): Promise<InventoryFormState> {
  const session = await requireRole("ADMIN");
  const itemId = value(formData, "itemId");
  try {
    await adjustInventory(
      {
        itemId,
        direction: value(formData, "direction") as "IN" | "OUT",
        quantityBase: value(formData, "quantityBase"),
        reason: value(formData, "reason"),
        allowNegative: value(formData, "allowNegative") === "true",
        idempotencyKey: value(formData, "idempotencyKey"),
      },
      session.user,
    );
    revalidatePath("/app/inventory");
    revalidatePath(`/app/inventory/${itemId}`);
    redirect(`/app/inventory/${itemId}?adjusted=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: inventoryMessage(error) };
  }
}

export async function createInventoryCategoryAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  await createInventoryCategory(
    { name: value(formData, "name") },
    session.user,
  );
  revalidatePath("/app/inventory/categories");
}

export async function toggleInventoryCategoryAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  await setInventoryCategoryActive(
    value(formData, "categoryId"),
    value(formData, "active") === "true",
    session.user,
  );
  revalidatePath("/app/inventory/categories");
}

export async function toggleInventoryItemAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const itemId = value(formData, "itemId");
  await setInventoryItemActive(
    itemId,
    value(formData, "active") === "true",
    session.user,
  );
  revalidatePath("/app/inventory");
  revalidatePath(`/app/inventory/${itemId}`);
}

export async function createPresentationAction(formData: FormData) {
  await requireRole("ADMIN");
  const itemId = value(formData, "itemId");
  await createPurchasePresentation({
    itemId,
    name: value(formData, "name"),
    factorToBase: value(formData, "factorToBase"),
  });
  revalidatePath(`/app/inventory/${itemId}`);
}

export async function togglePresentationAction(formData: FormData) {
  await requireRole("ADMIN");
  const result = await setPurchasePresentationActive(
    value(formData, "presentationId"),
    value(formData, "active") === "true",
  );
  revalidatePath(`/app/inventory/${result.itemId}`);
}

export async function reverseInventoryMovementAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const itemId = value(formData, "itemId");
  await reverseInventoryMovement(
    {
      movementId: value(formData, "movementId"),
      reason: value(formData, "reason"),
    },
    session.user,
  );
  revalidatePath("/app/inventory");
  revalidatePath(`/app/inventory/${itemId}`);
  redirect(`/app/inventory/${itemId}?reversed=1`);
}
