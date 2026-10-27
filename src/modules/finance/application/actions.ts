"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createFinancialCategory,
  recordFinancialEntry,
  reverseFinancialEntry,
  setAgreedAmount,
  setDirectCost,
  setFinancialCategoryActive,
} from "@/modules/finance/application/finance-service";
import { requireRole } from "@/modules/identity/application/authorization";

export interface FinanceFormState {
  status: "idle" | "error";
  message?: string;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function financeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "IDEMPOTENCY_CONFLICT")
    return "Los datos cambiaron después del primer intento. Recargá el formulario.";
  if (message === "CATEGORY_NOT_AVAILABLE")
    return "La categoría elegida ya no está disponible.";
  if (message === "SERVICE_CASE_NOT_FOUND")
    return "El trabajo o servicio seleccionado ya no existe.";
  return "No pudimos registrar el movimiento. Revisá los datos e intentá nuevamente.";
}

export async function saveFinancialEntryAction(
  _state: FinanceFormState,
  formData: FormData,
): Promise<FinanceFormState> {
  const session = await requireRole("ADMIN");
  try {
    const entry = await recordFinancialEntry(
      {
        kind: value(formData, "kind") as
          | "CUSTOMER_PAYMENT"
          | "CUSTOMER_REFUND"
          | "MANUAL_INCOME"
          | "MANUAL_EXPENSE",
        currency: value(formData, "currency") as "USD" | "ARS",
        amount: value(formData, "amount"),
        exchangeRateArsPerUsd: value(formData, "exchangeRateArsPerUsd"),
        occurredLocal: value(formData, "occurredLocal"),
        serviceCaseId: value(formData, "serviceCaseId"),
        categoryId: value(formData, "categoryId"),
        paymentMethod: value(formData, "paymentMethod") as
          "" | "TRANSFER" | "CASH" | "OTHER",
        description: value(formData, "description"),
        idempotencyKey: value(formData, "idempotencyKey"),
      },
      session.user,
    );
    revalidatePath("/app/finance");
    const serviceCaseId = value(formData, "serviceCaseId");
    if (serviceCaseId) revalidatePath(`/app/finance/cases/${serviceCaseId}`);
    redirect(`/app/finance?created=${entry.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: financeMessage(error) };
  }
}

export async function reverseFinancialEntryAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const entryId = value(formData, "entryId");
  const serviceCaseId = value(formData, "serviceCaseId");
  await reverseFinancialEntry(
    { entryId, reason: value(formData, "reason") },
    session.user,
  );
  revalidatePath("/app/finance");
  revalidatePath("/app/finance/salaries", "layout");
  revalidatePath("/app");
  if (serviceCaseId) {
    revalidatePath(`/app/finance/cases/${serviceCaseId}`);
    redirect(`/app/finance/cases/${serviceCaseId}?reversed=1`);
  }
  redirect("/app/finance?reversed=1");
}

export async function setAgreedAmountAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const serviceCaseId = value(formData, "serviceCaseId");
  await setAgreedAmount(
    {
      serviceCaseId,
      currency: value(formData, "currency") as "USD" | "ARS",
      amount: value(formData, "amount"),
      exchangeRateArsPerUsd: value(formData, "exchangeRateArsPerUsd"),
      reason: value(formData, "reason"),
    },
    session.user,
  );
  revalidatePath(`/app/finance/cases/${serviceCaseId}`);
  redirect(`/app/finance/cases/${serviceCaseId}?amount=1`);
}

export async function setDirectCostAction(formData: FormData) {
  await requireRole("ADMIN");
  const serviceCaseId = value(formData, "serviceCaseId");
  await setDirectCost({
    serviceCaseId,
    currency: value(formData, "currency") === "ARS" ? "ARS" : "USD",
    amount: value(formData, "amount"),
    exchangeRateArsPerUsd: value(formData, "exchangeRateArsPerUsd"),
  });
  revalidatePath(`/app/finance/cases/${serviceCaseId}`);
  revalidatePath("/app");
  revalidatePath("/app/jobs");
}

export async function createFinancialCategoryAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  await createFinancialCategory(
    {
      name: value(formData, "name"),
      direction: value(formData, "direction"),
    },
    session.user,
  );
  revalidatePath("/app/finance/categories");
}

export async function toggleFinancialCategoryAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  await setFinancialCategoryActive(
    value(formData, "categoryId"),
    value(formData, "active") === "true",
    session.user,
  );
  revalidatePath("/app/finance/categories");
}
