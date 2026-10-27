import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { brandConfig } from "@/config/brand";
import { prisma } from "@/infrastructure/db/client";
import {
  searchClientPickerOptions,
  searchVehiclePickerOptions,
} from "@/modules/clients/application/client-service";
import {
  renderQuotePdf,
  type QuotePdfData,
} from "@/infrastructure/pdf/quote-document";
import {
  getPrivateObject,
  putPrivateObject,
} from "@/infrastructure/storage/private-storage";
import { calculateQuote } from "@/modules/quotes/domain/quote-calculator";
import {
  quoteInputSchema,
  type QuoteInput,
} from "@/modules/quotes/domain/quote-schema";
import { getBusinessDateKey } from "@/shared/date-time/business-time";

interface Actor {
  id: string;
}

function civilDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function validateQuoteRelations(
  tx: Prisma.TransactionClient,
  input: QuoteInput,
) {
  const serviceIds = input.items
    .map((item) => item.serviceId)
    .filter((id): id is string => Boolean(id));
  const [vehicle, services] = await Promise.all([
    tx.vehicle.findFirst({
      where: { id: input.vehicleId, clientId: input.clientId, active: true },
      select: { id: true },
    }),
    tx.service.findMany({
      where: { id: { in: serviceIds }, active: true },
      select: { id: true },
    }),
  ]);
  if (!vehicle) throw new Error("VEHICLE_CLIENT_MISMATCH");
  if (services.length !== new Set(serviceIds).size)
    throw new Error("SERVICE_NOT_AVAILABLE");
}

function quoteData(input: QuoteInput) {
  if (input.validUntil && input.validUntil < input.issuedOn)
    throw new Error("INVALID_VALIDITY_RANGE");
  const totals = calculateQuote(
    input.items,
    input.discountUsd,
    input.currency,
    input.exchangeRateArsPerUsd,
  );
  return {
    issuedOn: civilDate(input.issuedOn),
    validUntil: input.validUntil ? civilDate(input.validUntil) : null,
    notes: input.notes,
    terms: input.terms,
    subtotalUsd: totals.subtotalUsd,
    discountUsd: totals.discountUsd,
    totalUsd: totals.totalUsd,
    sourceCurrency: input.currency,
    sourceSubtotal: totals.sourceSubtotal,
    sourceDiscount: totals.sourceDiscount,
    sourceTotal: totals.sourceTotal,
    exchangeRateArsPerUsd:
      input.currency === "ARS" ? input.exchangeRateArsPerUsd : null,
    items: {
      create: totals.items,
    },
  };
}

async function nextQuoteNumber(tx: Prisma.TransactionClient, year: number) {
  const sequence = await tx.quoteSequence.upsert({
    where: { year },
    create: { year, nextValue: 1 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  return `PRE-${year}-${String(sequence.nextValue).padStart(4, "0")}`;
}

export async function createQuote(input: QuoteInput, actor: Actor) {
  const data = quoteInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await validateQuoteRelations(tx, data);
    const year = Number(data.issuedOn.slice(0, 4));
    const number = await nextQuoteNumber(tx, year);
    return tx.quote.create({
      data: {
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        number,
        templateVersion: brandConfig.pdf.templateVersion,
        createdById: actor.id,
        updatedById: actor.id,
        ...quoteData(data),
      },
      select: { id: true },
    });
  });
}

export async function updateQuote(
  quoteId: string,
  input: QuoteInput,
  actor: Actor,
) {
  const data = quoteInputSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      select: { status: true },
    });
    if (!quote) throw new Error("QUOTE_NOT_FOUND");
    if (quote.status !== "DRAFT") throw new Error("QUOTE_NOT_EDITABLE");
    await validateQuoteRelations(tx, data);
    await tx.quoteItem.deleteMany({ where: { quoteId } });
    return tx.quote.update({
      where: { id: quoteId },
      data: {
        clientId: data.clientId,
        vehicleId: data.vehicleId,
        updatedById: actor.id,
        ...quoteData(data),
      },
      select: { id: true },
    });
  });
}

function toPdfData(
  quote: Awaited<ReturnType<typeof getQuoteDetail>>,
): QuotePdfData {
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  return {
    number: quote.number,
    status: quote.status,
    issuedOn: new Intl.DateTimeFormat("es-AR", {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(quote.issuedOn),
    validUntil: quote.validUntil
      ? new Intl.DateTimeFormat("es-AR", {
          dateStyle: "long",
          timeZone: "UTC",
        }).format(quote.validUntil)
      : undefined,
    clientName: quote.client.displayName,
    vehicle: [
      quote.vehicle.brand,
      quote.vehicle.model,
      quote.vehicle.version,
      quote.vehicle.year,
      quote.vehicle.color,
    ]
      .filter(Boolean)
      .join(" · "),
    notes: quote.notes ?? undefined,
    terms: quote.terms ?? undefined,
    currency: quote.sourceCurrency,
    sourceSubtotal: quote.sourceSubtotal.toFixed(2),
    sourceDiscount: quote.sourceDiscount.toFixed(2),
    sourceTotal: quote.sourceTotal.toFixed(2),
    exchangeRateArsPerUsd: quote.exchangeRateArsPerUsd?.toFixed(6) ?? undefined,
    subtotalUsd: quote.subtotalUsd.toFixed(2),
    discountUsd: quote.discountUsd.toFixed(2),
    totalUsd: quote.totalUsd.toFixed(2),
    items: quote.items.map((item) => ({
      name: item.nameSnapshot,
      description: item.descriptionSnapshot ?? undefined,
      quantity: item.quantity.toFixed(3).replace(/\.?0+$/, ""),
      unitPriceUsd: item.unitPriceUsd.toFixed(2),
      sourceUnitPrice: item.sourceUnitPrice.toFixed(2),
      discountUsd: item.discountUsd.toFixed(2),
      sourceDiscount: item.sourceDiscount.toFixed(2),
      totalUsd: item.totalUsd.toFixed(2),
      sourceTotal: item.sourceTotal.toFixed(2),
    })),
  };
}

export async function renderQuotePreview(quoteId: string) {
  const quote = await getQuoteDetail(quoteId);
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  return renderQuotePdf(toPdfData(quote), quote.status === "DRAFT");
}

export async function issueQuote(quoteId: string, actor: Actor) {
  const quote = await getQuoteDetail(quoteId);
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  if (quote.status !== "DRAFT") throw new Error("QUOTE_NOT_ISSUABLE");
  const pdf = await renderQuotePdf(toPdfData(quote), false);
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const artifactKey = `quotes/${quote.id}/${sha256}.pdf`;
  await putPrivateObject(artifactKey, pdf);
  const now = new Date();
  const result = await prisma.quote.updateMany({
    where: { id: quote.id, status: "DRAFT" },
    data: {
      status: "SENT",
      sentAt: now,
      pdfArtifactKey: artifactKey,
      pdfSha256: sha256,
      pdfGeneratedAt: now,
      updatedById: actor.id,
    },
  });
  if (result.count !== 1) throw new Error("QUOTE_NOT_ISSUABLE");
}

export async function getQuotePdf(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, pdfArtifactKey: true },
  });
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  if (quote.status !== "DRAFT" && quote.pdfArtifactKey)
    return getPrivateObject(quote.pdfArtifactKey);
  return renderQuotePreview(quoteId);
}

export async function acceptQuote(quoteId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        number: true,
        status: true,
        clientId: true,
        vehicleId: true,
        totalUsd: true,
        sourceCurrency: true,
        sourceTotal: true,
        exchangeRateArsPerUsd: true,
        acceptedServiceCase: { select: { id: true } },
      },
    });
    if (!quote) throw new Error("QUOTE_NOT_FOUND");
    if (quote.acceptedServiceCase)
      return { id: quote.acceptedServiceCase.id, replayed: true };
    if (quote.status !== "SENT") throw new Error("QUOTE_NOT_ACCEPTABLE");
    const serviceCase = await tx.serviceCase.create({
      data: {
        clientId: quote.clientId,
        vehicleId: quote.vehicleId,
        origin: "ACCEPTED_QUOTE",
        acceptedQuoteId: quote.id,
        agreedAmountUsd: quote.totalUsd,
        agreedSourceCurrency: quote.sourceCurrency,
        agreedSourceAmount: quote.sourceTotal,
        agreedExchangeRateArsPerUsd: quote.exchangeRateArsPerUsd,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await tx.serviceCaseAmountRevision.create({
      data: {
        serviceCaseId: serviceCase.id,
        previousAmountUsd: null,
        newAmountUsd: quote.totalUsd,
        sourceCurrency: quote.sourceCurrency,
        sourceAmount: quote.sourceTotal,
        exchangeRateArsPerUsd: quote.exchangeRateArsPerUsd,
        reason: `Presupuesto ${quote.number} aceptado`,
        createdById: actor.id,
      },
    });
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        updatedById: actor.id,
      },
    });
    return { id: serviceCase.id, replayed: false };
  });
}

export async function rejectQuote(quoteId: string, actor: Actor) {
  const result = await prisma.quote.updateMany({
    where: { id: quoteId, status: "SENT" },
    data: { status: "REJECTED", rejectedAt: new Date(), updatedById: actor.id },
  });
  if (result.count !== 1) throw new Error("QUOTE_NOT_REJECTABLE");
}

export async function duplicateQuote(quoteId: string, actor: Actor) {
  const source = await getQuoteDetail(quoteId);
  if (!source) throw new Error("QUOTE_NOT_FOUND");
  const today = getBusinessDateKey(new Date());
  return createQuote(
    {
      clientId: source.clientId,
      vehicleId: source.vehicleId,
      issuedOn: today,
      validUntil: undefined,
      notes: source.notes ?? undefined,
      terms: source.terms ?? undefined,
      currency: source.sourceCurrency,
      exchangeRateArsPerUsd: source.exchangeRateArsPerUsd?.toString() ?? "",
      discountUsd: source.sourceDiscount.toFixed(2),
      items: source.items.map((item) => ({
        serviceId: item.serviceId ?? undefined,
        name: item.nameSnapshot,
        description: item.descriptionSnapshot ?? undefined,
        quantity: item.quantity.toFixed(3),
        unitPriceUsd: item.sourceUnitPrice.toFixed(2),
        discountUsd: item.sourceDiscount.toFixed(2),
      })),
    },
    actor,
  );
}

export async function listQuoteOptions(
  selectedClientId?: string,
  selectedVehicleId?: string,
) {
  const [clients, vehicles, services] = await Promise.all([
    searchClientPickerOptions({ selectedId: selectedClientId }),
    selectedClientId
      ? searchVehiclePickerOptions({
          clientId: selectedClientId,
          selectedId: selectedVehicleId,
        })
      : [],
    prisma.service.findMany({
      where: { active: true, category: { active: true } },
      select: {
        id: true,
        name: true,
        commercialDescription: true,
        basePriceUsd: true,
        category: { select: { name: true } },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
  ]);
  return { clients, vehicles, services };
}

export async function listQuotes(options: {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = options.query?.trim();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const today = civilDate(getBusinessDateKey(new Date()));
  const statusWhere: Prisma.QuoteWhereInput =
    options.status === "expired"
      ? { status: "SENT", validUntil: { lt: today } }
      : options.status &&
          ["DRAFT", "SENT", "ACCEPTED", "REJECTED"].includes(options.status)
        ? {
            status: options.status as
              "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED",
          }
        : {};
  const where: Prisma.QuoteWhereInput = {
    ...statusWhere,
    OR: query
      ? [
          { number: { contains: query, mode: "insensitive" } },
          { client: { displayName: { contains: query, mode: "insensitive" } } },
          { vehicle: { brand: { contains: query, mode: "insensitive" } } },
          { vehicle: { model: { contains: query, mode: "insensitive" } } },
        ]
      : undefined,
  };
  const [items, total] = await prisma.$transaction([
    prisma.quote.findMany({
      where,
      select: {
        id: true,
        number: true,
        status: true,
        issuedOn: true,
        validUntil: true,
        totalUsd: true,
        client: { select: { displayName: true } },
        vehicle: { select: { brand: true, model: true } },
      },
      orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.quote.count({ where }),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    today,
  };
}

export async function getQuoteDetail(id: string) {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return null;
  const client = await prisma.client.findUnique({
    where: { id: quote.clientId },
  });
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: quote.vehicleId },
  });
  if (!client || !vehicle) return null;
  const items = await prisma.quoteItem.findMany({
    where: { quoteId: quote.id },
    orderBy: { sortOrder: "asc" },
  });
  const serviceCase = await prisma.serviceCase.findUnique({
    where: { acceptedQuoteId: quote.id },
    select: { id: true, agreedAmountUsd: true },
  });
  const appointments = serviceCase
    ? await prisma.appointment.findMany({
        where: { serviceCaseId: serviceCase.id },
        select: { id: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      })
    : [];

  return {
    ...quote,
    client,
    vehicle,
    items,
    acceptedServiceCase: serviceCase ? { ...serviceCase, appointments } : null,
  };
}

export async function listClientQuotes(clientId: string) {
  return prisma.quote.findMany({
    where: { clientId },
    select: {
      id: true,
      number: true,
      status: true,
      totalUsd: true,
      issuedOn: true,
      vehicle: { select: { brand: true, model: true } },
    },
    orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }],
    take: 10,
  });
}

export function quoteDateKey(value: Date) {
  return dateKey(value);
}
