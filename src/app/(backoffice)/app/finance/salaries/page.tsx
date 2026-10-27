import type { Metadata } from "next";
import Link from "next/link";
import { Page, PageHeader } from "@/components/patterns/page";
import { buttonClassName } from "@/components/ui/button";
import { requireRole } from "@/modules/identity/application/authorization";
import { listSalaries } from "@/modules/salaries/application/salary-service";
import {
  usd,
  formatSalaryMonth,
  salaryStatusLabels,
} from "@/modules/salaries/ui/format";
import styles from "@/modules/salaries/ui/salaries.module.css";

export const metadata: Metadata = { title: "Sueldos" };

export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; pending?: string }>;
}) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const pending = params.pending === "1";
  const result = await listSalaries({ month: params.month, pending });
  return (
    <Page size="wide" className={styles.page}>
      <PageHeader
        title="Sueldos"
        description="Cargá cada sueldo una vez. Se repite todos los meses hasta que lo desactives."
        actions={
          <>
            <Link href="/app/finance" className={buttonClassName("secondary")}>
              Ver Finanzas
            </Link>
            <Link
              href="/app/finance/salaries/new"
              className={buttonClassName()}
            >
              Agregar sueldo
            </Link>
          </>
        }
      />
      <form className={styles.toolbar} role="search">
        <label>
          <span>Mes</span>
          <input
            type="month"
            name="month"
            defaultValue={result.month}
            min={result.minMonth}
            max={result.currentMonth}
            required
          />
        </label>
        {pending ? <input type="hidden" name="pending" value="1" /> : null}
        <button className={buttonClassName("secondary")}>Ver mes</button>
        {pending ? (
          <Link
            href={`/app/finance/salaries?month=${result.month}`}
            className="text-link"
          >
            Ver todos los estados del mes
          </Link>
        ) : null}
      </form>
      <dl
        className={styles.summary}
        aria-label={`Resumen de ${formatSalaryMonth(result.month)}`}
      >
        <div>
          <dt>Total del mes</dt>
          <dd>{usd.format(result.totalUsd.toNumber())}</dd>
        </div>
        <div>
          <dt>Pendiente de pagar</dt>
          <dd>{usd.format(result.pendingUsd.toNumber())}</dd>
        </div>
        <div>
          <dt>Pagado</dt>
          <dd>{usd.format(result.paidUsd.toNumber())}</dd>
        </div>
      </dl>
      {result.previousCount > 0 ? (
        <aside className={styles.notice}>
          <strong>
            Quedan {result.previousCount} sueldo(s) pendiente(s) de meses
            anteriores: {usd.format(result.previousUsd.toNumber())}.
          </strong>{" "}
          <Link
            href={`/app/finance/salaries?month=${result.month}&pending=1`}
            className="text-link"
          >
            Ver todos los pendientes
          </Link>
        </aside>
      ) : null}
      {pending ? (
        <p className={styles.muted}>
          Mostrando pendientes hasta {formatSalaryMonth(result.month)}. El
          resumen de arriba corresponde únicamente al mes seleccionado.
        </p>
      ) : null}
      {result.items.length ? (
        <section className={styles.list} aria-label="Sueldos del período">
          {result.items.map((item) => {
            const href = `/app/finance/salaries/${item.salaryId}?month=${item.month}`;
            const rate = item.salary.rates[0];
            return (
              <article key={item.id} className={styles.row}>
                <div className={styles.person}>
                  <h2>
                    <Link href={href} className="text-link">
                      {item.salary.name}
                    </Link>
                  </h2>
                  <small className={styles.muted}>
                    {formatSalaryMonth(item.month)}
                  </small>
                  {item.salary.endMonth ? (
                    <small className={styles.muted}>
                      Último mes: {formatSalaryMonth(item.salary.endMonth)}
                    </small>
                  ) : null}
                  {rate &&
                  rate.effectiveMonth > result.currentMonth &&
                  (!item.salary.endMonth ||
                    rate.effectiveMonth <= item.salary.endMonth) ? (
                    <small className={styles.muted}>
                      Desde {formatSalaryMonth(rate.effectiveMonth)}:{" "}
                      {usd.format(rate.amountUsd.toNumber())}
                    </small>
                  ) : null}
                </div>
                <strong className={styles.amount}>
                  {usd.format(item.amountUsd.toNumber())}
                </strong>
                <span
                  className={`${styles.badge} ${item.status === "PAID" ? styles.paid : styles.pending}`}
                >
                  {salaryStatusLabels[item.status]}
                </span>
                <div className={styles.actions}>
                  {item.status === "PENDING" ? (
                    <>
                      <Link
                        href={`${href}&action=edit`}
                        className={buttonClassName("secondary", "sm")}
                      >
                        Ajustar
                      </Link>
                      <Link
                        href={`${href}&action=pay`}
                        className={buttonClassName("primary", "sm")}
                      >
                        Registrar pago
                      </Link>
                    </>
                  ) : (
                    <Link href={href} className="text-link">
                      Ver detalle
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <h2>
            {pending
              ? "No quedan sueldos pendientes."
              : "Todavía no hay sueldos en este mes."}
          </h2>
          <p>Agregá una persona y su importe mensual para empezar.</p>
          <Link href="/app/finance/salaries/new" className={buttonClassName()}>
            Agregar sueldo
          </Link>
        </section>
      )}
    </Page>
  );
}
