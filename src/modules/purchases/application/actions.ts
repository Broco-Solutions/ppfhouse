"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  createSupplier,
  postPurchase,
  setSupplierActive,
  voidPurchase,
} from "@/modules/purchases/application/purchase-service";

export interface PurchaseFormState {
  status: "idle" | "error";
  message?: string;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function purchaseMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "PRESENTATION_ITEM_MISMATCH")
    return "La presentación no pertenece al artículo seleccionado.";
  if (message === "BASE_QUANTITY_PRECISION")
    return "La conversión supera los 3 decimales admitidos para stock.";
  if (message === "SUPPLIER_NOT_AVAILABLE")
    return "El proveedor seleccionado ya no está disponible.";
  if (message === "INVENTORY_ITEM_NOT_AVAILABLE")
    return "Uno de los artículos ya no está disponible.";
  if (message === "IDEMPOTENCY_CONFLICT")
    return "Los datos cambiaron después del primer intento. Recargá el formulario.";
  return "No pudimos registrar la compra. Revisá los datos e intentá nuevamente.";
}

export async function postPurchaseAction(
  _state: PurchaseFormState,
  formData: FormData,
): Promise<PurchaseFormState> {
  const session = await requireRole("ADMIN");
  try {
    const parsedItems: unknown = JSON.parse(value(formData, "items"));
    if (!Array.isArray(parsedItems)) throw new Error("INVALID_ITEMS");
    const result = await postPurchase(
      {
        supplierId: value(formData, "supplierId"),
        currency: value(formData, "currency") as "USD" | "ARS",
        exchangeRateArsPerUsd: value(formData, "exchangeRateArsPerUsd"),
        businessDate: value(formData, "businessDate"),
        reference: value(formData, "reference"),
        notes: value(formData, "notes"),
        idempotencyKey: value(formData, "idempotencyKey"),
        items: parsedItems as {
          itemId: string;
          presentationId: string;
          quantityPurchased: string;
          unitCostUsd: string;
        }[],
      },
      session.user,
    );
    revalidatePath("/app/purchases");
    revalidatePath("/app/inventory");
    revalidatePath("/app/finance");
    redirect(`/app/purchases/${result.id}?created=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: purchaseMessage(error) };
  }
}

export async function createSupplierAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  await createSupplier(
    {
      name: value(formData, "name"),
      contactName: value(formData, "contactName"),
      phone: value(formData, "phone"),
      email: value(formData, "email"),
      notes: value(formData, "notes"),
    },
    session.user,
  );
  revalidatePath("/app/purchases/suppliers");
}

export async function toggleSupplierAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  await setSupplierActive(
    value(formData, "supplierId"),
    value(formData, "active") === "true",
    session.user,
  );
  revalidatePath("/app/purchases/suppliers");
}

export async function voidPurchaseAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const purchaseId = value(formData, "purchaseId");
  try {
    await voidPurchase(
      { purchaseId, reason: value(formData, "reason") },
      session.user,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PURCHASE_STOCK_ALREADY_USED"
    )
      redirect(`/app/purchases/${purchaseId}?voidError=stock`);
    throw error;
  }
  revalidatePath("/app/purchases");
  revalidatePath(`/app/purchases/${purchaseId}`);
  revalidatePath("/app/inventory");
  revalidatePath("/app/finance");
  redirect(`/app/purchases/${purchaseId}?voided=1`);
}
