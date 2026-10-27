import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { requireRole } from "@/modules/identity/application/authorization";
import { getQuoteDetail } from "@/modules/quotes/application/quote-service";
import { QuoteScheduleForm } from "@/modules/quotes/ui/quote-schedule-form";
import { listSchedulingOptions } from "@/modules/scheduling/application/scheduling-service";
import {
  addCivilDays,
  getBusinessDateKey,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Agendar presupuesto" };

export default async function ScheduleQuotePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  await requireRole("ADMIN");
  const { quoteId } = await params;
  const [quote, options] = await Promise.all([
    getQuoteDetail(quoteId),
    listSchedulingOptions(),
  ]);
  if (!quote) notFound();
  if (quote.status !== "ACCEPTED" || !quote.acceptedServiceCase)
    redirect(`/app/quotes/${quote.id}`);
  const existing = quote.acceptedServiceCase.appointments[0];
  if (existing) redirect(`/app/calendar/${existing.id}`);
  const today = getBusinessDateKey(new Date());
  return (
    <div className="page-stack page-narrow">
      <Link href={`/app/quotes/${quote.id}`} className="back-link">
        ← {quote.number}
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">Presupuesto aceptado</p>
          <h1>Agendar servicio</h1>
          <p className="page-description">
            {quote.client.displayName} · {quote.vehicle.brand}{" "}
            {quote.vehicle.model} · USD {quote.totalUsd.toFixed(2)}
          </p>
        </div>
      </header>
      <QuoteScheduleForm
        quoteId={quote.id}
        idempotencyKey={crypto.randomUUID()}
        startLocal={`${addCivilDays(today, 1)}T09:00`}
        endLocal={`${addCivilDays(today, 1)}T13:00`}
        employees={options.employees}
      />
    </div>
  );
}
