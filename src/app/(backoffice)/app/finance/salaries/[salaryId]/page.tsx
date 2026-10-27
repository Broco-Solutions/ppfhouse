import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { requireRole } from "@/modules/identity/application/authorization";
import { getSalaryDetail } from "@/modules/salaries/application/salary-service";
import { nextSalaryMonth } from "@/modules/salaries/domain/salary-schema";
import { SalaryForm } from "@/modules/salaries/ui/salary-form";
import {
  usd,
  formatSalaryMonth,
  salaryStatusLabels,
} from "@/modules/salaries/ui/format";
import styles from "@/modules/salaries/ui/salaries.module.css";
import {
  formatBusinessDateTime,
  getBusinessMonthKey,
  formatBusinessDateTimeInput,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Detalle de sueldo" };
const eventLabels: Record<string, string> = {
  CREATED: "Sueldo agregado",
  ADJUSTED: "Importe ajustado",
  PAID: "Pago registrado",
  PAYMENT_REVERSED: "Pago revertido",
  CANCELLED: "Mes anulado",
  STOPPED: "Fin de la repetición programado",
};

export default async function SalaryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ salaryId: string }>;
  searchParams: Promise<{ month?: string; action?: string; saved?: string }>;
}) {
  await requireRole("ADMIN");
  const { salaryId } = await params;
  const query = await searchParams;
  const now = new Date();
  const current = getBusinessMonthKey(now);
  const next = nextSalaryMonth(current);
  const salary = await getSalaryDetail(salaryId, now);
  if (!salary) notFound();
  const selected =
    salary.months.find((item) => item.month === query.month) ??
    salary.months[0];
  const future =
    query.action === "future" && (!salary.endMonth || salary.endMonth >= next);
  const month = future ? next : (selected?.month ?? current);
  const rate = salary.rates.find((item) => item.effectiveMonth <= month);
  const pending = selected?.status === "PENDING";
  const formProps = {
    salaryId,
    version: salary.version,
    month: selected?.month ?? current,
    currentMonth: current,
  };
  const editing = future || (query.action === "edit" && pending);
  const paying = query.action === "pay" && pending;
  const scheduled = salary.rates.find(
    (item) =>
      item.effectiveMonth > current &&
      (!salary.endMonth || item.effectiveMonth <= salary.endMonth),
  );
  const local = formatBusinessDateTimeInput(now);
  return (
    <Page className={styles.page} size="default">
      <PageHeader
        title={salary.name}
        description={`Sueldo mensual en USD · desde ${formatSalaryMonth(salary.startMonth)}`}
        actions={
          <Link
            href={`/app/finance/salaries?month=${selected?.month ?? current}`}
            className={buttonClassName("secondary")}
          >
            Volver a sueldos
          </Link>
        }
      />
      {query.saved ? (
        <p className="success-banner" role="status">
          Los cambios se guardaron y los indicadores están actualizados.
        </p>
      ) : null}
      <p className={styles.muted}>
        {salary.endMonth
          ? `Se repite hasta ${formatSalaryMonth(salary.endMonth)}, inclusive.`
          : "Se repite automáticamente todos los meses."}
        {scheduled
          ? ` Desde ${formatSalaryMonth(scheduled.effectiveMonth)}: ${usd.format(scheduled.amountUsd.toNumber())}.`
          : ""}
      </p>
      <form className={styles.toolbar}>
        <label>
          <span>Mes del sueldo</span>
          <select name="month" defaultValue={selected?.month}>
            {salary.months.map((item) => (
              <option key={item.id} value={item.month}>
                {formatSalaryMonth(item.month)} ·{" "}
                {salaryStatusLabels[item.status]}
              </option>
            ))}
          </select>
        </label>
        <button className={buttonClassName("secondary")}>Ver mes</button>
      </form>
      {selected ? (
        <section className={styles.section} aria-label="Detalle del mes">
          <h2>{formatSalaryMonth(selected.month)}</h2>
          <div className={styles.actions}>
            <strong className={styles.amount}>
              {usd.format(selected.amountUsd.toNumber())}
            </strong>
            <span
              className={`${styles.badge} ${selected.status === "PAID" ? styles.paid : styles.pending}`}
            >
              {salaryStatusLabels[selected.status]}
            </span>
          </div>
          {selected.payment ? (
            <p>
              Pagado el {formatBusinessDateTime(selected.payment.occurredAt)} ·{" "}
              {
                (
                  {
                    TRANSFER: "Transferencia",
                    CASH: "Efectivo",
                    OTHER: "Otro",
                  } as const
                )[selected.payment.paymentMethod ?? "OTHER"]
              }{" "}
              · USD {selected.payment.amountUsd.toFixed(2)}.{" "}
              <Link
                href={`/app/finance?month=${getBusinessMonthKey(selected.payment.occurredAt)}&type=SALARY_PAYMENT`}
                className="text-link"
              >
                Ver en Finanzas
              </Link>
            </p>
          ) : null}
          <div className={styles.actions}>
            {pending && !paying ? (
              <Link
                href={`?month=${selected.month}&action=pay`}
                className={buttonClassName()}
              >
                Registrar pago
              </Link>
            ) : null}
            {pending && !editing ? (
              <Link
                href={`?month=${selected.month}&action=edit`}
                className={buttonClassName("secondary")}
              >
                Ajustar importe
              </Link>
            ) : null}
            {!salary.endMonth || salary.endMonth >= next ? (
              <Link
                href={`?month=${selected.month}&action=future`}
                className="text-link"
              >
                Cambiar desde el próximo mes
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
      {editing ? (
        <section className={styles.section}>
          <h2>
            {future
              ? `Nuevo importe desde ${formatSalaryMonth(next)}`
              : `Ajustar ${formatSalaryMonth(month)}`}
          </h2>
          <SalaryForm
            key={`adjust-${month}-${salary.version}`}
            {...formProps}
            operation="adjust"
            month={month}
            amount={
              future
                ? rate?.amountUsd.toFixed(2)
                : selected?.amountUsd.toFixed(2)
            }
            future={future}
          />
        </section>
      ) : null}
      {paying ? (
        <section className={styles.section}>
          <h2>Registrar pago de {formatSalaryMonth(month)}</h2>
          <SalaryForm
            key={`pay-${month}-${salary.version}`}
            {...formProps}
            operation="pay"
            amount={selected?.amountUsd.toFixed(2)}
            occurredLocal={local}
            idempotencyKey={randomUUID()}
          />
        </section>
      ) : null}
      {selected?.payment ? (
        <details className={styles.disclosure}>
          <summary>
            Corregir pago de {formatSalaryMonth(selected.month)}
          </summary>
          <SalaryForm
            {...formProps}
            operation="reverse"
            entryId={selected.payment.id}
          />
        </details>
      ) : null}
      {pending ? (
        <details className={styles.disclosure}>
          <summary>
            Anular carga de {formatSalaryMonth(selected!.month)}
          </summary>
          <SalaryForm {...formProps} operation="cancel" />
        </details>
      ) : null}
      {!salary.endMonth ? (
        <details className={styles.disclosure}>
          <summary>Dejar de repetir este sueldo</summary>
          <SalaryForm {...formProps} month={current} operation="stop" />
        </details>
      ) : null}
      <section className={styles.section}>
        <h2>Historial de cambios y pagos</h2>
        <ol className={styles.history}>
          {salary.events.map((item) => {
            const detail =
              item.detail &&
              typeof item.detail === "object" &&
              !Array.isArray(item.detail)
                ? item.detail
                : {};
            const eventMonth =
              typeof detail.month === "string"
                ? detail.month
                : typeof detail.lastMonth === "string"
                  ? detail.lastMonth
                  : null;
            return (
              <li key={item.id}>
                <strong>
                  {eventLabels[item.action] ?? item.action}
                  {eventMonth ? ` · ${formatSalaryMonth(eventMonth)}` : ""}
                </strong>
                {typeof detail.amountUsd === "string" ? (
                  <span>
                    {usd.format(Number(detail.amountUsd))}
                    {typeof detail.previousAmountUsd === "string"
                      ? ` (antes: ${usd.format(Number(detail.previousAmountUsd))})`
                      : ""}
                  </span>
                ) : null}
                {detail.scope ? (
                  <span>
                    {detail.scope === "MONTH"
                      ? "Solo este mes"
                      : "Desde este mes en adelante"}
                  </span>
                ) : null}
                {typeof detail.reason === "string" ? (
                  <span>{detail.reason}</span>
                ) : null}
                <small>
                  {formatBusinessDateTime(item.createdAt)} ·{" "}
                  {item.createdBy?.name ?? "Usuario eliminado"}
                </small>
              </li>
            );
          })}
        </ol>
      </section>
    </Page>
  );
}
