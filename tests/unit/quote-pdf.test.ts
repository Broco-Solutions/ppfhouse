import { describe, expect, it } from "vitest";

import {
  renderQuotePdf,
  type QuotePdfData,
} from "@/infrastructure/pdf/quote-document";

const base: QuotePdfData = {
  number: "PRE-2026-0001",
  status: "DRAFT",
  issuedOn: "2 de octubre de 2026",
  validUntil: "17 de octubre de 2026",
  clientName: "Martina López",
  vehicle: "Porsche · Macan · 2025 · Gris",
  subtotalUsd: "450.00",
  discountUsd: "0.00",
  totalUsd: "450.00",
  terms: "Valores expresados en USD.",
  currency: "USD",
  sourceSubtotal: "450.00",
  sourceDiscount: "0.00",
  sourceTotal: "450.00",
  items: [
    {
      name: "Tratamiento cerámico",
      description: "Protección premium",
      quantity: "1",
      unitPriceUsd: "450.00",
      sourceUnitPrice: "450.00",
      discountUsd: "0.00",
      sourceDiscount: "0.00",
      totalUsd: "450.00",
      sourceTotal: "450.00",
    },
  ],
};

describe("quote PDF", () => {
  it("renders both one-page and multi-page content as valid PDF bytes", async () => {
    const single = await renderQuotePdf(base, true);
    const multiple = await renderQuotePdf(
      {
        ...base,
        items: Array.from({ length: 35 }, (_, index) => ({
          ...base.items[0]!,
          name: `Servicio premium ${index + 1}`,
          description:
            "Descripción extensa con caracteres españoles: protección, terminación y garantía.",
        })),
      },
      false,
    );
    expect(single.subarray(0, 4).toString()).toBe("%PDF");
    expect(multiple.subarray(0, 4).toString()).toBe("%PDF");
    expect(multiple.length).toBeGreaterThan(single.length);
  });
});
