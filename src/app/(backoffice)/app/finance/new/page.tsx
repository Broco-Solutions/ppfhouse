import type { Metadata } from "next";
import Link from "next/link";

import { listFinancialOptions } from "@/modules/finance/application/finance-service";
import { FinancialEntryForm } from "@/modules/finance/ui/financial-entry-form";
import { requireRole } from "@/modules/identity/application/authorization";
import { formatBusinessDateTimeInput } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Nuevo movimiento" };

export default async function NewFinancialEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const options = await listFinancialOptions();
  return (
    <div className="page-stack narrow-page">
      <Link href="/app/finance" className="back-link">
        ← Finanzas
      </Link>
      <header className="page-header">
        <p className="eyebrow">Caja real</p>
        <h1>Registrar movimiento</h1>
        <p className="page-description">
          Una seña puede existir antes del trabajo y nunca cambia su estado
          operativo.
        </p>
      </header>
      <FinancialEntryForm
        defaultOccurredLocal={formatBusinessDateTimeInput(new Date())}
        defaultServiceCaseId={params.caseId}
        categories={options.categories}
        serviceCases={options.serviceCases.map((item) => ({
          id: item.id,
          clientName: item.client.displayName,
          vehicle: `${item.vehicle.brand} ${item.vehicle.model}${item.vehicle.year ? ` · ${item.vehicle.year}` : ""}`,
          agreedAmountUsd: item.agreedAmountUsd?.toFixed(2) ?? null,
        }))}
      />
    </div>
  );
}
