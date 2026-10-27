import { getSalarySummary } from "@/modules/salaries/application/salary-service";
import type { Metadata } from "next";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { DataToolbar, Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { reverseFinancialEntryAction } from "@/modules/finance/application/actions";
import { listFinancialEntries } from "@/modules/finance/application/finance-service";
import styles from "@/modules/finance/ui/finance.module.css";
import { requireRole } from "@/modules/identity/application/authorization";
import { formatBusinessDateTime } from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Finanzas" };

const typeLabels = {
  CUSTOMER_PAYMENT: "Cobro de cliente",
  CUSTOMER_REFUND: "Devolución",
  PURCHASE: "Compra",
  MANUAL_INCOME: "Ingreso manual",
  MANUAL_EXPENSE: "Egreso manual",
  SALARY_PAYMENT: "Pago de sueldo",
  REVERSAL: "Reversión",
} as const;

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    direction?: string;
    type?: string;
    page?: string;
    created?: string;
    reversed?: string;
  }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const result = await listFinancialEntries({
    month: params.month,
    direction: params.direction,
    type: params.type,
    page: Number(params.page) || 1,
  });
  const filtered = Boolean(params.direction || params.type);
  const salaries = await getSalarySummary();

  return (
    <Page className={styles.page} size="wide">
      <PageHeader
        eyebrow="Caja interna · USD"
        title="Finanzas"
        description="Dinero efectivamente cobrado o pagado, separado del importe acordado y del trabajo operativo."
        actions={
          <>
            <Link
              href="/app/finance/salaries"
              className={buttonClassName("secondary")}
            >
              Sueldos
            </Link>
            <Link
              href="/app/finance/categories"
              className={buttonClassName("secondary")}
            >
              Categorías
            </Link>
            <Link
              href="/app/finance/new"
              className={buttonClassName("primary")}
            >
              <PlusIcon aria-hidden="true" />
              Nuevo movimiento
            </Link>
          </>
        }
      />

      {params.created ? (
        <p className="success-banner" role="status">
          Movimiento registrado sin modificar la agenda ni el trabajo.
        </p>
      ) : null}
      {params.reversed ? (
        <p className="success-banner" role="status">
          Movimiento revertido mediante un asiento compensatorio.
        </p>
      ) : null}

      <section className={styles.kpis} aria-label="Resumen del período">
        <article className={styles.kpi}>
          <span>Entradas</span>
          <strong>USD {result.inflowUsd.toFixed(2)}</strong>
        </article>
        <article className={styles.kpi}>
          <span>Salidas</span>
          <strong>USD {result.outflowUsd.toFixed(2)}</strong>
        </article>
        <article className={styles.kpi}>
          <span>Flujo neto</span>
          <strong>USD {result.netUsd.toFixed(2)}</strong>
        </article>
      </section>

      <p className={styles.meta}>
        <Link href="/app/finance/salaries?pending=1" className="text-link">
          Sueldos pendientes: USD {salaries.pendingUsd.toFixed(2)}
        </Link>
        {" · "}
        {salaries.pendingCount} sueldo(s), incluidos {salaries.previousCount} de
        meses anteriores.
      </p>

      <DataToolbar>
        <form className={styles.filters} role="search">
          <label className={styles.filterField}>
            <span>Mes</span>
            <input type="month" name="month" defaultValue={result.month} />
          </label>
          <label className={styles.filterField}>
            <span>Dirección</span>
            <select name="direction" defaultValue={params.direction ?? ""}>
              <option value="">Todas</option>
              <option value="INFLOW">Entradas</option>
              <option value="OUTFLOW">Salidas</option>
            </select>
          </label>
          <label className={styles.filterField}>
            <span>Tipo</span>
            <select name="type" defaultValue={params.type ?? ""}>
              <option value="">Todos</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.filterActions}>
            <button className="ghost-button">Aplicar</button>
            {filtered ? (
              <Link
                href={`/app/finance?month=${result.month}`}
                className="text-link"
              >
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      </DataToolbar>

      <div className={styles.meta}>
        <strong>{result.total}</strong> movimientos
      </div>
      {result.items.length ? (
        <section className={styles.ledger} aria-label="Movimientos financieros">
          {result.items.map((entry) => {
            const caseLabel = entry.serviceCase
              ? `${entry.serviceCase.client.displayName} · ${entry.serviceCase.vehicle.brand} ${entry.serviceCase.vehicle.model}`
              : entry.category?.name;
            return (
              <article className={styles.row} key={entry.id}>
                <div className={styles.main}>
                  <span className={styles.type}>{typeLabels[entry.type]}</span>
                  <strong>
                    {caseLabel || entry.description || "Sin categoría"}
                  </strong>
                  <small>{formatBusinessDateTime(entry.occurredAt)}</small>
                </div>
                <strong
                  className={`${styles.money} ${entry.direction === "INFLOW" ? styles.inflow : styles.outflow}`}
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
                {entry.serviceCase ? (
                  <Link
                    href={`/app/finance/cases/${entry.serviceCase.id}`}
                    className="text-link"
                  >
                    Ver saldo
                  </Link>
                ) : null}
                {entry.salaryMonth ? (
                  <Link
                    href={`/app/finance/salaries/${entry.salaryMonth.salaryId}?month=${entry.salaryMonth.month}`}
                    className="text-link"
                  >
                    Ver sueldo
                  </Link>
                ) : null}
                {entry.type !== "REVERSAL" && !entry.reversedBy ? (
                  <form
                    action={reverseFinancialEntryAction}
                    className={styles.reverse}
                  >
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input
                      name="reason"
                      aria-label={`Motivo para revertir ${typeLabels[entry.type]}`}
                      placeholder="Motivo"
                      minLength={3}
                      required
                    />
                    <ConfirmButton
                      className="text-button danger-text"
                      message="Se creará un movimiento compensatorio. ¿Continuar?"
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
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">
            {filtered ? "Sin coincidencias" : "Sin movimientos"}
          </p>
          <h2>
            {filtered
              ? "No hay movimientos con estos filtros."
              : "Todavía no hay movimientos en este período."}
          </h2>
          <p>Registrá caja sólo cuando el dinero efectivamente entra o sale.</p>
          <Link href="/app/finance/new" className="ghost-button button-link">
            Registrar movimiento
          </Link>
        </section>
      )}
    </Page>
  );
}
