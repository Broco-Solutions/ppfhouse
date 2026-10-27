import { DeleteRecordLink } from "@/modules/deletion/ui/delete-record-link";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetailHeader, Page } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { requireRole } from "@/modules/identity/application/authorization";
import {
  acceptQuoteAction,
  duplicateQuoteAction,
  rejectQuoteAction,
} from "@/modules/quotes/application/actions";
import { IssueQuoteForm } from "@/modules/quotes/ui/issue-quote-form";
import { getQuoteDetail } from "@/modules/quotes/application/quote-service";
import styles from "@/modules/quotes/ui/quotes.module.css";

export const metadata: Metadata = { title: "Presupuesto" };
const labels = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
} as const;

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{
    saved?: string;
    issued?: string;
    accepted?: string;
    rejected?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const [{ quoteId }, notices] = await Promise.all([params, searchParams]);
  const quote = await getQuoteDetail(quoteId);
  if (!quote) notFound();
  const appointment = quote.acceptedServiceCase?.appointments[0];
  return (
    <Page className={styles.page} size="default">
      <Link href="/app/quotes" className="back-link">
        ← Presupuestos
      </Link>
      {notices.saved ? (
        <p className="success-banner" role="status">
          El borrador quedó guardado.
        </p>
      ) : null}
      {notices.issued ? (
        <p className="success-banner" role="status">
          Presupuesto emitido y PDF congelado.
        </p>
      ) : null}
      {notices.accepted ? (
        <p className="success-banner" role="status">
          Presupuesto aceptado. El importe acordado quedó fijado.
        </p>
      ) : null}
      {notices.rejected ? (
        <p className="warning-banner" role="status">
          Presupuesto marcado como rechazado.
        </p>
      ) : null}
      <DetailHeader
        eyebrow={labels[quote.status]}
        title={quote.number}
        description={`${quote.client.displayName} · ${quote.vehicle.brand} ${quote.vehicle.model}`}
        actions={
          <>
            <Link
              href={`/api/quotes/${quote.id}/pdf`}
              target="_blank"
              className={buttonClassName("secondary")}
            >
              {quote.status === "DRAFT" ? "Preview PDF" : "Descargar PDF"}
            </Link>
            {quote.status === "DRAFT" ? (
              <Link
                href={`/app/quotes/${quote.id}/edit`}
                className={buttonClassName("secondary")}
              >
                Editar
              </Link>
            ) : null}
            <DeleteRecordLink kind="quote" id={quote.id} />
          </>
        }
      />

      <section className={styles.sheet}>
        <div className={styles.sheetHeader}>
          <div>
            <span>Cliente</span>
            <strong>{quote.client.displayName}</strong>
          </div>
          <div>
            <span>Vehículo</span>
            <strong>
              {quote.vehicle.brand} {quote.vehicle.model}
            </strong>
          </div>
        </div>
        <div className={styles.lines}>
          {quote.items.map((item) => (
            <article className={styles.line} key={item.id}>
              <div>
                <strong>{item.nameSnapshot}</strong>
                {item.descriptionSnapshot ? (
                  <p>{item.descriptionSnapshot}</p>
                ) : null}
              </div>
              <span>
                {item.quantity.toFixed(3).replace(/\.?0+$/, "")} ×{" "}
                {quote.sourceCurrency} {item.sourceUnitPrice.toFixed(2)}
                {item.sourceDiscount.isPositive() ? (
                  <small>
                    {" "}
                    · Descuento {quote.sourceCurrency}{" "}
                    {item.sourceDiscount.toFixed(2)}
                  </small>
                ) : null}
              </span>
              <b>
                {quote.sourceCurrency} {item.sourceTotal.toFixed(2)}
              </b>
            </article>
          ))}
        </div>
        <div className={styles.total}>
          <span>
            Subtotal{" "}
            <b>
              {quote.sourceCurrency} {quote.sourceSubtotal.toFixed(2)}
            </b>
          </span>
          {quote.discountUsd.isPositive() ? (
            <span>
              Descuento{" "}
              <b>
                − {quote.sourceCurrency} {quote.sourceDiscount.toFixed(2)}
              </b>
            </span>
          ) : null}
          <strong>
            Total · {quote.sourceCurrency} {quote.sourceTotal.toFixed(2)}
          </strong>
        </div>
        {quote.sourceCurrency === "ARS" ? (
          <p>
            1 USD = ARS {quote.exchangeRateArsPerUsd?.toString()} · Equivalente
            canónico USD {quote.totalUsd.toFixed(2)}
          </p>
        ) : null}
      </section>
      <section className={styles.actions} aria-label="Acciones del presupuesto">
        {quote.status === "DRAFT" ? (
          <IssueQuoteForm quoteId={quote.id} buttonClassName="primary-button" />
        ) : null}
        {quote.status === "SENT" ? (
          <>
            <form action={acceptQuoteAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <ConfirmButton
                className="primary-button"
                variant="primary"
                message="¿Confirmar que el cliente aceptó? El total pasará a ser el importe acordado."
              >
                Marcar aceptado
              </ConfirmButton>
            </form>
            <form action={rejectQuoteAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <ConfirmButton
                className="ghost-button"
                message="¿Marcar este presupuesto como rechazado?"
              >
                Marcar rechazado
              </ConfirmButton>
            </form>
          </>
        ) : null}
        {quote.status === "ACCEPTED" && !appointment ? (
          <Link
            href={`/app/quotes/${quote.id}/schedule`}
            className="primary-button button-link"
          >
            Convertir en turno
          </Link>
        ) : null}
        {appointment ? (
          <Link
            href={`/app/calendar/${appointment.id}`}
            className="primary-button button-link"
          >
            Ver turno
          </Link>
        ) : null}
        {quote.acceptedServiceCase ? (
          <Link
            href={`/app/finance/cases/${quote.acceptedServiceCase.id}`}
            className="ghost-button button-link"
          >
            Ver cobros
          </Link>
        ) : null}
        <form action={duplicateQuoteAction}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <button className="ghost-button">Duplicar como borrador</button>
        </form>
      </section>
      <p className="muted-copy">
        Aceptar o emitir no registra ningún cobro. La operación y la caja
        permanecen independientes.
      </p>
    </Page>
  );
}
