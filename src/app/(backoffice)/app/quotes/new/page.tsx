import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/identity/application/authorization";
import { listQuoteOptions } from "@/modules/quotes/application/quote-service";
import { QuoteForm } from "@/modules/quotes/ui/quote-form";
import {
  getBusinessDateKey,
  addCivilDays,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Nuevo presupuesto" };

export default async function NewQuotePage() {
  await requireRole("ADMIN");
  const raw = await listQuoteOptions();
  const options = {
    ...raw,
    services: raw.services.map((service) => ({
      ...service,
      basePriceUsd: service.basePriceUsd?.toFixed(2) ?? null,
    })),
  };
  const today = getBusinessDateKey(new Date());
  return (
    <div className="page-stack">
      <Link href="/app/quotes" className="back-link">
        ← Presupuestos
      </Link>
      <header className="page-header">
        <div>
          <p className="eyebrow">Nueva propuesta</p>
          <h1>Crear presupuesto</h1>
          <p className="page-description">
            Catálogo como punto de partida; cada línea queda congelada al
            guardar.
          </p>
        </div>
      </header>
      <QuoteForm
        options={options}
        values={{ issuedOn: today, validUntil: addCivilDays(today, 15) }}
      />
    </div>
  );
}
