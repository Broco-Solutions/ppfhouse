"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logger } from "@/infrastructure/logging/logger";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  acceptQuote,
  createQuote,
  duplicateQuote,
  issueQuote,
  rejectQuote,
  updateQuote,
} from "@/modules/quotes/application/quote-service";
import { quoteInputSchema } from "@/modules/quotes/domain/quote-schema";
import { createAppointmentFromQuote } from "@/modules/scheduling/application/scheduling-service";

export interface QuoteFormState {
  status: "idle" | "error";
  message?: string;
  fields?: Record<string, string>;
}

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item : "";
}

function values(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((item) => (typeof item === "string" ? item : ""));
}

function quoteItems(formData: FormData) {
  const names = values(formData, "itemName");
  const serviceIds = values(formData, "itemServiceId");
  const descriptions = values(formData, "itemDescription");
  const quantities = values(formData, "itemQuantity");
  const prices = values(formData, "itemUnitPriceUsd");
  const discounts = values(formData, "itemDiscountUsd");
  return names.map((name, index) => ({
    serviceId: serviceIds[index] ?? "",
    name,
    description: descriptions[index] ?? "",
    quantity: quantities[index] ?? "",
    unitPriceUsd: prices[index] ?? "",
    discountUsd: discounts[index] || "0",
  }));
}

function domainMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "ITEM_DISCOUNT_EXCEEDS_GROSS")
    return "El descuento de un ítem supera su importe.";
  if (message === "GLOBAL_DISCOUNT_EXCEEDS_SUBTOTAL")
    return "El descuento general supera el subtotal.";
  if (message === "INVALID_VALIDITY_RANGE")
    return "La vigencia no puede terminar antes de la fecha del presupuesto.";
  if (message === "VEHICLE_CLIENT_MISMATCH")
    return "El vehículo no pertenece al cliente seleccionado.";
  if (message === "QUOTE_NOT_EDITABLE")
    return "Un presupuesto emitido ya no puede editarse. Duplicalo para crear una revisión.";
  return "No pudimos guardar el presupuesto. Revisá los datos e intentá nuevamente.";
}

export async function saveQuoteAction(
  _state: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const session = await requireRole("ADMIN");
  const parsed = quoteInputSchema.safeParse({
    clientId: value(formData, "clientId"),
    vehicleId: value(formData, "vehicleId"),
    currency: value(formData, "currency") as "USD" | "ARS",
    exchangeRateArsPerUsd: value(formData, "exchangeRateArsPerUsd"),
    issuedOn: value(formData, "issuedOn"),
    validUntil: value(formData, "validUntil"),
    notes: value(formData, "notes"),
    terms: value(formData, "terms"),
    discountUsd: value(formData, "discountUsd") || "0",
    items: quoteItems(formData),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revisá los datos del presupuesto y sus ítems.",
      fields: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ]),
      ),
    };
  }
  const quoteId = value(formData, "quoteId");
  try {
    const quote = quoteId
      ? await updateQuote(quoteId, parsed.data, session.user)
      : await createQuote(parsed.data, session.user);
    revalidatePath("/app/quotes");
    redirect(`/app/quotes/${quote.id}?saved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", message: domainMessage(error) };
  }
}

export async function issueQuoteAction(
  _state: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const session = await requireRole("ADMIN");
  const id = value(formData, "quoteId");
  try {
    await issueQuote(id, session.user);
  } catch (error) {
    logger.error("quote_issue_failed", {
      quoteId: id,
      error: error instanceof Error ? error.name : "UnknownError",
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    });
    return {
      status: "error",
      message:
        "No pudimos emitir el presupuesto. Intentá nuevamente; si el problema continúa, avisá a un administrador.",
    };
  }
  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${id}`);
  redirect(`/app/quotes/${id}?issued=1`);
}

export async function acceptQuoteAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const id = value(formData, "quoteId");
  await acceptQuote(id, session.user);
  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${id}`);
  redirect(`/app/quotes/${id}?accepted=1`);
}

export async function rejectQuoteAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const id = value(formData, "quoteId");
  await rejectQuote(id, session.user);
  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${id}`);
  redirect(`/app/quotes/${id}?rejected=1`);
}

export async function duplicateQuoteAction(formData: FormData) {
  const session = await requireRole("ADMIN");
  const quote = await duplicateQuote(value(formData, "quoteId"), session.user);
  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${quote.id}/edit?duplicated=1`);
}

export async function scheduleAcceptedQuoteAction(
  _state: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const session = await requireRole("ADMIN");
  try {
    const appointment = await createAppointmentFromQuote(
      {
        quoteId: value(formData, "quoteId"),
        startLocal: value(formData, "startLocal"),
        endLocal: value(formData, "endLocal"),
        employeeIds: values(formData, "employeeIds"),
        internalNotes: value(formData, "internalNotes"),
        visibleToClient: value(formData, "visibleToClient") === "on",
        idempotencyKey: value(formData, "idempotencyKey"),
      },
      session.user,
    );
    revalidatePath("/app/calendar");
    revalidatePath(`/app/quotes/${value(formData, "quoteId")}`);
    redirect(`/app/calendar/${appointment.id}?created=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = error instanceof Error ? error.message : "";
    return {
      status: "error",
      message: message.startsWith("CALENDAR_BLOCKED:")
        ? `Ese horario está bloqueado: ${message.split(":").slice(1).join(":")}.`
        : "No pudimos crear el turno. Revisá el horario e intentá nuevamente.",
    };
  }
}
