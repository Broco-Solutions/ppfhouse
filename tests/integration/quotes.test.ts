import { rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createPostgresAdapter } from "@/infrastructure/db/adapter";
import * as privateStorage from "@/infrastructure/storage/private-storage";
import { setAgreedAmount } from "@/modules/finance/application/finance-service";
import {
  acceptQuote,
  createQuote,
  getQuotePdf,
  issueQuote,
  updateQuote,
} from "@/modules/quotes/application/quote-service";
import { createAppointmentFromQuote } from "@/modules/scheduling/application/scheduling-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: createPostgresAdapter(connectionString),
});
const suffix = randomUUID().slice(0, 8);
let actorId = "";
let clientId = "";
let vehicleId = "";
let serviceId = "";
let quoteId = "";
let arsQuoteId = "";
let arsCaseId = "";
let caseId = "";
let appointmentId = "";

describe("quotes and conversion integration", () => {
  beforeAll(async () => {
    actorId = (
      await prisma.user.create({
        data: {
          name: `Quote actor ${suffix}`,
          email: `quote-${suffix}@ferraro.test`,
          emailVerified: true,
          role: "ADMIN",
        },
      })
    ).id;
    clientId = (
      await prisma.client.create({
        data: { displayName: `Quote client ${suffix}` },
      })
    ).id;
    vehicleId = (
      await prisma.vehicle.create({
        data: { clientId, brand: "Ford", model: "Raptor", year: 2026 },
      })
    ).id;
    const category = await prisma.serviceCategory.create({
      data: { name: `Quote category ${suffix}` },
    });
    serviceId = (
      await prisma.service.create({
        data: {
          categoryId: category.id,
          name: `PPF ${suffix}`,
          commercialDescription: "Cobertura frontal",
          basePriceUsd: "720",
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (appointmentId) {
      await prisma.appointmentEmployee.deleteMany({ where: { appointmentId } });
      await prisma.appointmentService.deleteMany({ where: { appointmentId } });
      await prisma.idempotencyKey.deleteMany({
        where: { resultReference: appointmentId },
      });
      await prisma.appointment.deleteMany({ where: { id: appointmentId } });
    }
    if (caseId) {
      await prisma.serviceCaseAmountRevision.deleteMany({
        where: { serviceCaseId: caseId },
      });
      await prisma.serviceCase.deleteMany({ where: { id: caseId } });
    }
    if (arsCaseId) {
      await prisma.serviceCaseAmountRevision.deleteMany({
        where: { serviceCaseId: arsCaseId },
      });
      await prisma.serviceCase.deleteMany({ where: { id: arsCaseId } });
    }
    if (arsQuoteId) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: arsQuoteId } });
      await prisma.quote.deleteMany({ where: { id: arsQuoteId } });
    }
    if (quoteId) {
      await prisma.quoteItem.deleteMany({ where: { quoteId } });
      await prisma.quote.deleteMany({ where: { id: quoteId } });
      await rm(path.resolve(process.cwd(), ".data/private/quotes", quoteId), {
        recursive: true,
        force: true,
      });
    }
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { categoryId: true },
    });
    await prisma.service.deleteMany({ where: { id: serviceId } });
    if (service)
      await prisma.serviceCategory.deleteMany({
        where: { id: service.categoryId },
      });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.client.deleteMany({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  it("keeps snapshots, emits a PDF, accepts once and schedules the same case", async () => {
    const quote = await createQuote(
      {
        currency: "USD",
        clientId,
        vehicleId,
        issuedOn: "2026-10-02",
        validUntil: "2026-10-20",
        discountUsd: "20",
        items: [
          {
            serviceId,
            name: `PPF ${suffix}`,
            description: "Cobertura frontal",
            quantity: "1",
            unitPriceUsd: "720",
            discountUsd: "0",
          },
        ],
      },
      { id: actorId },
    );
    quoteId = quote.id;
    await updateQuote(
      quoteId,
      {
        currency: "USD",
        clientId,
        vehicleId,
        issuedOn: "2026-10-02",
        validUntil: "2026-10-20",
        discountUsd: "20",
        terms: "Condición histórica",
        items: [
          {
            serviceId,
            name: `PPF ${suffix}`,
            description: "Cobertura frontal",
            quantity: "1",
            unitPriceUsd: "720",
            discountUsd: "0",
          },
        ],
      },
      { id: actorId },
    );
    await prisma.service.update({
      where: { id: serviceId },
      data: { name: `PPF nuevo ${suffix}`, basePriceUsd: "900" },
    });
    const failedStorage = vi
      .spyOn(privateStorage, "putPrivateObject")
      .mockRejectedValueOnce(new Error("STORAGE_TEST_FAILURE"));
    try {
      await expect(issueQuote(quoteId, { id: actorId })).rejects.toThrow(
        "STORAGE_TEST_FAILURE",
      );
      const draft = await prisma.quote.findUniqueOrThrow({
        where: { id: quoteId },
      });
      expect(draft.status).toBe("DRAFT");
      expect(draft.pdfArtifactKey).toBeNull();
      expect(draft.pdfSha256).toBeNull();
    } finally {
      failedStorage.mockRestore();
    }
    await issueQuote(quoteId, { id: actorId });
    const pdf = await getQuotePdf(quoteId);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(2_000);
    const accepted = await acceptQuote(quoteId, { id: actorId });
    caseId = accepted.id;
    await setAgreedAmount(
      {
        serviceCaseId: caseId,
        currency: "USD",
        amount: "750",
        reason: "Alcance ampliado después de aceptar",
      },
      { id: actorId },
    );
    await expect(acceptQuote(quoteId, { id: actorId })).resolves.toEqual({
      id: caseId,
      replayed: true,
    });
    const scheduled = await createAppointmentFromQuote(
      {
        quoteId,
        startLocal: "2027-02-10T09:00",
        endLocal: "2027-02-10T13:00",
        employeeIds: [],
        visibleToClient: true,
        idempotencyKey: randomUUID(),
      },
      { id: actorId },
    );
    appointmentId = scheduled.id;
    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: {
        items: true,
        acceptedServiceCase: {
          include: { appointments: { include: { services: true } } },
        },
      },
    });
    expect(stored.items[0]).toMatchObject({ nameSnapshot: `PPF ${suffix}` });
    expect(stored.totalUsd.toFixed(2)).toBe("700.00");
    expect(stored.acceptedServiceCase?.agreedAmountUsd?.toFixed(2)).toBe(
      "750.00",
    );
    expect(
      stored.acceptedServiceCase?.appointments[0]?.services[0]?.nameSnapshot,
    ).toBe(`PPF ${suffix}`);
  });

  it("preserves ARS quote values and accepts the USD canonical equivalent", async () => {
    const quote = await createQuote(
      {
        currency: "ARS",
        exchangeRateArsPerUsd: "1560",
        clientId,
        vehicleId,
        issuedOn: "2026-10-04",
        validUntil: "2026-10-20",
        discountUsd: "0",
        items: [
          {
            serviceId: "",
            name: `ARS ${suffix}`,
            quantity: "1",
            unitPriceUsd: "780000",
            discountUsd: "0",
          },
        ],
      },
      { id: actorId },
    );
    arsQuoteId = quote.id;
    const stored = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
      include: { items: true },
    });
    expect(stored.totalUsd.toFixed(2)).toBe("500.00");
    expect(stored.sourceTotal.toFixed(2)).toBe("780000.00");
    expect(stored.items[0]?.sourceUnitPrice.toFixed(2)).toBe("780000.00");
    await issueQuote(quote.id, { id: actorId });
    arsCaseId = (await acceptQuote(quote.id, { id: actorId })).id;
    const acceptedCase = await prisma.serviceCase.findUniqueOrThrow({
      where: { id: arsCaseId },
    });
    expect(acceptedCase.agreedAmountUsd?.toFixed(2)).toBe("500.00");
    expect(acceptedCase.agreedSourceCurrency).toBe("ARS");
    expect(acceptedCase.agreedSourceAmount?.toFixed(2)).toBe("780000.00");
  });
});
