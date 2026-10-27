import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import {
  getQuoteDetail,
  listQuoteOptions,
  quoteDateKey,
} from "@/modules/quotes/application/quote-service";
import { QuoteForm } from "@/modules/quotes/ui/quote-form";

export const metadata: Metadata = { title: "Editar presupuesto" };

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  await requireRole("ADMIN");
  const { quoteId } = await params;
  const quote = await getQuoteDetail(quoteId);
  if (!quote) notFound();
  if (quote.status !== "DRAFT") redirect(`/app/quotes/${quote.id}`);
  const raw = await listQuoteOptions(quote.clientId, quote.vehicleId);
  const options = {
    ...raw,
    services: raw.services.map((service) => ({
      ...service,
      basePriceUsd: service.basePriceUsd?.toFixed(2) ?? null,
    })),
  };
  return (
    <div className="page-stack">
      <Link href={`/app/quotes/${quote.id}`} className="back-link">
        ← {quote.number}
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">Borrador editable</p>
          <h1>{quote.number}</h1>
          <p className="page-description">
            Al emitirlo, el contenido quedará bloqueado.
          </p>
        </div>
      </header>
      <QuoteForm
        options={options}
        values={{
          quoteId: quote.id,
          clientId: quote.clientId,
          vehicleId: quote.vehicleId,
          issuedOn: quoteDateKey(quote.issuedOn),
          validUntil: quote.validUntil
            ? quoteDateKey(quote.validUntil)
            : undefined,
          notes: quote.notes,
          terms: quote.terms,
          currency: quote.sourceCurrency,
          exchangeRateArsPerUsd:
            quote.exchangeRateArsPerUsd?.toString() ?? null,
          discountUsd: quote.sourceDiscount.toFixed(2),
          items: quote.items.map((item) => ({
            serviceId: item.serviceId ?? "",
            name: item.nameSnapshot,
            description: item.descriptionSnapshot ?? "",
            quantity: item.quantity.toFixed(3),
            unitPriceUsd: item.sourceUnitPrice.toFixed(2),
            discountUsd: item.sourceDiscount.toFixed(2),
          })),
        }}
      />
    </div>
  );
}
