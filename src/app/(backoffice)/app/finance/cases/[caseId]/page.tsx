import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  reverseFinancialEntryAction,
  setAgreedAmountAction,
} from "@/modules/finance/application/actions";
import { getCaseFinancialSummary } from "@/modules/finance/application/finance-service";
import styles from "@/modules/finance/ui/finance.module.css";
import { requireRole } from "@/modules/identity/application/authorization";
import { formatBusinessDateTime } from "@/shared/date-time/business-time";
import { MoneyField } from "@/modules/money/ui/money-field";
import { profitability } from "@/modules/money/domain/money";

export const metadata: Metadata = { title: "Estado de cobro" };

export default async function CaseFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ amount?: string; reversed?: string }>;
}) {
  await requireRole("ADMIN");
  const { caseId } = await params;
  const query = await searchParams;
  const summary = await getCaseFinancialSummary(caseId);
  if (!summary || !summary.client || !summary.vehicle) notFound();
  const knownMargin = profitability(
    summary.agreedAmountUsd,
    summary.directCostUsd,
  );
  return (
    <Page className={styles.page} size="default">
      <Link href="/app/finance" className="back-link">
        ← Finanzas
      </Link>
      <DetailHeader
        eyebrow="Estado comercial"
        title={summary.client.displayName}
        description={`${summary.vehicle.brand} ${summary.vehicle.model}${summary.vehicle.year ? ` · ${summary.vehicle.year}` : ""}`}
        actions={
          <>
            <Link
              href={`/app/finance/new?caseId=${caseId}`}
              className={buttonClassName("primary")}
            >
              Registrar cobro
            </Link>
            <DeleteRecordLink kind="serviceCase" id={caseId} />
          </>
        }
      />

      {query.amount ? (
        <p className="success-banner">Importe acordado actualizado.</p>
      ) : null}
      {query.reversed ? (
        <p className="success-banner">Cobro revertido sin borrar historia.</p>
      ) : null}
      <section className={styles.balance} aria-label="Resumen de saldo">
        <article>
          <span>Importe acordado</span>
          <strong>
            {summary.agreedAmountUsd
              ? `USD ${summary.agreedAmountUsd.toFixed(2)}`
              : "Importe por definir"}
          </strong>
          {summary.agreedSourceCurrency === "ARS" ? (
            <small>
              ARS {summary.agreedSourceAmount?.toFixed(2)} · 1 USD = ARS{" "}
              {summary.agreedExchangeRateArsPerUsd?.toString()}
            </small>
          ) : null}
        </article>
        <article>
          <span>Cobrado neto</span>
          <strong>USD {summary.collectedUsd.toFixed(2)}</strong>
        </article>
        <article>
          <span>
            {summary.balanceUsd?.isNegative()
              ? "Saldo a favor"
              : "Saldo pendiente"}
          </span>
          <strong>
            {summary.balanceUsd === null
              ? "No calculable"
              : `USD ${summary.balanceUsd.abs().toFixed(2)}`}
          </strong>
        </article>
      </section>
      <section className="form-section">
        <div className="form-section-heading">
          <p className="eyebrow">Acuerdo comercial</p>
          <h2>Actualizar importe</h2>
        </div>
        <form
          action={setAgreedAmountAction}
          className="inline-create-form finance-inline-form"
        >
          <input type="hidden" name="serviceCaseId" value={caseId} />
          <MoneyField
            amountLabel="Nuevo importe"
            initialCurrency={summary.agreedSourceCurrency ?? "USD"}
            initialAmount={
              summary.agreedSourceAmount?.toString() ??
              summary.agreedAmountUsd?.toFixed(2) ??
              ""
            }
            initialRate={summary.agreedExchangeRateArsPerUsd?.toString() ?? ""}
          />
          <label className="grow-field">
            <span>Motivo *</span>
            <input
              name="reason"
              minLength={3}
              maxLength={300}
              required
              placeholder="Cambio de alcance acordado"
            />
          </label>
          <button className="ghost-button">Actualizar</button>
        </form>
      </section>
      <section className={styles.balance} aria-label="Rentabilidad del caso">
        <article>
          <span>Costo directo</span>
          <strong>
            {summary.directCostUsd === null
              ? "Sin imputar"
              : `USD ${summary.directCostUsd.toFixed(2)}`}
          </strong>
          {summary.directCostSourceCurrency === "ARS" ? (
            <small>
              ARS {summary.directCostSourceAmount?.toFixed(2)} · 1 USD = ARS{" "}
              {summary.directCostExchangeRateArsPerUsd?.toString()}
            </small>
          ) : null}
        </article>
        <article>
          <span>Margen conocido</span>
          <strong>
            {knownMargin ? `USD ${knownMargin.marginUsd.toFixed(2)}` : "—"}
          </strong>
        </article>
        <article>
          <span>Margen porcentual</span>
          <strong>
            {knownMargin?.marginPercent === null || !knownMargin
              ? "—"
              : `${knownMargin.marginPercent.toFixed(2)}%`}
          </strong>
        </article>
      </section>
      <section className="detail-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Caja</p>
            <h2>Cobros y correcciones</h2>
          </div>
        </div>
        {summary.entries.length ? (
          <div className="financial-list">
            {summary.entries.map((entry) => (
              <article className="financial-row" key={entry.id}>
                <div className="financial-main">
                  <strong>
                    {entry.type === "CUSTOMER_PAYMENT"
                      ? "Cobro"
                      : entry.type === "CUSTOMER_REFUND"
                        ? "Devolución"
                        : "Reversión"}
                  </strong>
                  <small>{formatBusinessDateTime(entry.occurredAt)}</small>
                </div>
                <strong
                  className={
                    entry.direction === "INFLOW"
                      ? "money-positive"
                      : "money-negative"
                  }
                >
                  {entry.direction === "INFLOW" ? "+" : "−"} USD{" "}
                  {entry.amountUsd.toFixed(2)}
                </strong>
                {entry.sourceCurrency === "ARS" ? (
                  <small>
                    ARS {entry.sourceAmount.toFixed(2)} · 1 USD = ARS{" "}
                    {entry.exchangeRateArsPerUsd?.toString()}
                  </small>
                ) : null}
                {entry.type !== "REVERSAL" && !entry.reversedBy ? (
                  <form
                    action={reverseFinancialEntryAction}
                    className="reverse-form"
                  >
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="serviceCaseId" value={caseId} />
                    <input
                      name="reason"
                      aria-label="Motivo de reversión"
                      minLength={3}
                      required
                      placeholder="Motivo"
                    />
                    <ConfirmButton
                      className="text-button danger-text"
                      message="Se compensará este movimiento sin borrarlo. ¿Continuar?"
                    >
                      Revertir
                    </ConfirmButton>
                  </form>
                ) : (
                  <span className="status-badge">
                    {entry.type === "REVERSAL" ? "Compensación" : "Revertido"}
                  </span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Todavía no hay cobros. El turno y el trabajo pueden continuar igual.
          </div>
        )}
      </section>
      <section className="detail-section">
        <p className="eyebrow">Trazabilidad</p>
        <h2>Historial de importe acordado</h2>
        <div className={styles.timeline}>
          {summary.revisions.map((revision) => (
            <article key={revision.id}>
              <strong>USD {revision.newAmountUsd.toFixed(2)}</strong>
              <span>{revision.reason}</span>
              <small>{formatBusinessDateTime(revision.createdAt)}</small>
            </article>
          ))}
        </div>
      </section>
    </Page>
  );
}
