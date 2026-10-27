import {
  ArrowRightIcon,
  CalendarPlusIcon,
  CarProfileIcon,
  ClipboardTextIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserPlusIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import {
  getAdminDashboard,
  getOperationalDashboard,
} from "@/modules/dashboard/application/dashboard-service";
import styles from "@/modules/dashboard/ui/dashboard.module.css";
import { requireUser } from "@/modules/identity/application/session";
import {
  formatBusinessDateTime,
  formatBusinessTime,
  getBusinessDateKey,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Inicio" };

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

type QuickActionIcon = ComponentType<{
  "aria-hidden"?: boolean;
  size?: number;
  weight?: "bold";
}>;

export default async function AppHomePage() {
  const session = await requireUser();
  const now = new Date();
  const [operational, admin] = await Promise.all([
    getOperationalDashboard(now),
    session.user.role === "ADMIN"
      ? getAdminDashboard(now)
      : Promise.resolve(null),
  ]);
  const quickActions: Array<{
    all: boolean;
    href: string;
    icon: QuickActionIcon;
    label: string;
  }> = [
    {
      label: "Nuevo turno",
      href: "/app/calendar/new",
      all: true,
      icon: CalendarPlusIcon,
    },
    {
      label: "Nuevo cliente",
      href: "/app/clients/new",
      all: true,
      icon: UserPlusIcon,
    },
    {
      label: "Nuevo trabajo",
      href: "/app/jobs/new",
      all: true,
      icon: WrenchIcon,
    },
    {
      label: "Presupuesto",
      href: "/app/quotes/new",
      all: false,
      icon: ClipboardTextIcon,
    },
    {
      label: "Compra",
      href: "/app/purchases/new",
      all: false,
      icon: ShoppingCartIcon,
    },
    {
      label: "Ingreso / egreso",
      href: "/app/finance/new",
      all: false,
      icon: CurrencyDollarIcon,
    },
  ].filter((item) => item.all || session.user.role === "ADMIN");

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{getBusinessDateKey(now)}</p>
          <h1>¿Qué pasa hoy en Ferraro?</h1>
          <p className={styles.description}>
            {operational.todayAppointments.length
              ? `${operational.todayAppointments.length} turno(s) activo(s) en la jornada.`
              : "La jornada no tiene turnos confirmados."}
          </p>
        </div>
        <span className={styles.location}>
          <span aria-hidden="true" className={styles.locationDot} />
          Rosario · {formatBusinessDateTime(now)}
        </span>
      </header>

      <nav aria-label="Acciones rápidas" className={styles.quickActions}>
        {quickActions.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link
              className={`${styles.quickAction} ${index === 0 ? styles.quickActionPrimary : ""}`}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden size={16} weight="bold" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.todayGrid}>
        <DashboardSection
          className={styles.primarySection}
          eyebrow="Operación de hoy"
          href="/app/calendar"
          link="Ver agenda"
          title="Turnos de hoy"
        >
          {operational.todayAppointments.length ? (
            <div className={styles.list}>
              {operational.todayAppointments.map((appointment) => (
                <Link
                  className={styles.listItem}
                  href={`/app/calendar/${appointment.id}`}
                  key={appointment.id}
                >
                  <time
                    className={styles.time}
                    dateTime={appointment.startAt.toISOString()}
                  >
                    {formatBusinessTime(appointment.startAt)}
                  </time>
                  <span className={styles.itemCopy}>
                    <strong>
                      {appointment.serviceCase.vehicle.brand}{" "}
                      {appointment.serviceCase.vehicle.model}
                    </strong>
                    <small>
                      {appointment.serviceCase.client.displayName}
                      {appointment.services.length
                        ? ` · ${appointment.services.map((service) => service.nameSnapshot).join(", ")}`
                        : ""}
                    </small>
                  </span>
                  <ArrowRightIcon aria-hidden size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <DashboardEmpty
              text="Creá un turno o revisá los próximos días."
              title="Jornada despejada"
            />
          )}
        </DashboardSection>

        <DashboardSection
          count={operational.upcomingAppointments.length}
          eyebrow="Próximamente"
          title="Siguientes turnos"
        >
          {operational.upcomingAppointments.length ? (
            <div className={styles.list}>
              {operational.upcomingAppointments.map((appointment) => (
                <Link
                  className={styles.listItem}
                  href={`/app/calendar/${appointment.id}`}
                  key={appointment.id}
                >
                  <time
                    className={styles.time}
                    dateTime={appointment.startAt.toISOString()}
                  >
                    {formatBusinessDateTime(appointment.startAt)}
                  </time>
                  <span className={styles.itemCopy}>
                    <strong>
                      {appointment.serviceCase.vehicle.brand}{" "}
                      {appointment.serviceCase.vehicle.model}
                    </strong>
                    <small>{appointment.serviceCase.client.displayName}</small>
                  </span>
                  <ArrowRightIcon aria-hidden size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <DashboardEmpty
              text="La agenda futura está libre."
              title="Sin próximos turnos"
            />
          )}
        </DashboardSection>
      </div>

      {admin ? (
        <section className={styles.finance} aria-labelledby="finance-summary">
          <header className={styles.financeHeader}>
            <div>
              <p className={styles.eyebrow}>Administración · mes en curso</p>
              <h2 id="finance-summary">Pulso financiero</h2>
            </div>
            <div>
              <p>Lectura de caja, actividad y saldos realizados.</p>
              <Link href="/app/finance/salaries" className="text-link">
                Ver sueldos pendientes
              </Link>
            </div>
          </header>
          <div className={styles.kpis}>
            <Kpi
              detail="Ingresos menos egresos"
              label="Flujo neto"
              primary
              value={money.format(admin.cashNetUsd.toNumber())}
            />
            <Kpi
              detail="Caja de clientes neta"
              label="Cobrado este mes"
              value={money.format(admin.collectedUsd.toNumber())}
            />
            <Kpi
              detail="Salidas reales de caja"
              label="Egresos este mes"
              value={money.format(admin.outflowUsd.toNumber())}
            />
            <Kpi
              detail={`Ticket acordado medio ${money.format(admin.averageAgreedUsd.toNumber())}`}
              label="Trabajos del mes"
              value={String(admin.jobsThisMonth)}
            />
            <Kpi
              attention
              detail={`${admin.pendingCases.length} caso(s) prioritario(s)`}
              label="Saldo pendiente realizado"
              value={money.format(admin.pendingBalanceUsd.toNumber())}
            />
            <Kpi
              attention={admin.salaries.pendingCount > 0}
              detail={`${admin.salaries.pendingCount} sueldo(s); ${admin.salaries.previousCount} de meses anteriores · USD`}
              label="Sueldos pendientes"
              value={money.format(admin.salaries.pendingUsd.toNumber())}
            />
            {admin.marginCaseCount > 0 ? (
              <Kpi
                detail="Suma de casos con importe y costo informados"
                label="Margen conocido"
                value={money.format(admin.knownMarginUsd.toNumber())}
              />
            ) : null}
            {admin.caseCount > 0 ? (
              <Kpi
                detail={`${admin.costCount} de ${admin.caseCount} casos con costo imputado`}
                label="Cobertura de costos"
                value={`${((admin.costCount / admin.caseCount) * 100).toFixed(1)}%`}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <div className={styles.supportGrid}>
        <DashboardSection
          eyebrow="Actividad"
          href="/app/jobs"
          link="Ver todos"
          title="Trabajos recientes"
        >
          {operational.recentJobs.length ? (
            <div className={`${styles.list} ${styles.compactList}`}>
              {operational.recentJobs.map((job) => (
                <Link
                  className={styles.listItem}
                  href={`/app/jobs/${job.id}`}
                  key={job.id}
                >
                  <span className={styles.itemCopy}>
                    <strong>
                      {job.serviceCase.vehicle.brand}{" "}
                      {job.serviceCase.vehicle.model}
                    </strong>
                    <small>
                      {job.serviceCase.client.displayName} ·{" "}
                      {formatBusinessDateTime(job.performedAt)} ·{" "}
                      {job._count.photos} foto(s)
                    </small>
                  </span>
                  <ArrowRightIcon aria-hidden size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <DashboardEmpty
              text="Los trabajos realizados aparecerán acá."
              title="Sin trabajos recientes"
            />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Inventario"
          href="/app/inventory?lowStock=1"
          link="Revisar"
          title="Stock bajo"
        >
          {operational.lowStock.length ? (
            <div className={`${styles.list} ${styles.compactList}`}>
              {operational.lowStock.map((item) => (
                <Link
                  className={styles.listItem}
                  href={`/app/inventory/${item.id}`}
                  key={item.id}
                >
                  <span className={styles.itemCopy}>
                    <strong>{item.name}</strong>
                    <small>
                      {item.currentStock.toFixed(3)} {item.baseUnit} · mínimo{" "}
                      {item.minimumStock.toFixed(3)}
                    </small>
                  </span>
                  <ArrowRightIcon aria-hidden size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <DashboardEmpty
              text="No hay alertas de reposición."
              title="Stock dentro de mínimos"
            />
          )}
        </DashboardSection>
      </div>

      {admin ? (
        <div className={styles.followupGrid}>
          <DashboardSection
            count={admin.pendingCases.length}
            eyebrow="Cobranza"
            title="Saldos pendientes"
          >
            {admin.pendingCases.length ? (
              <div className={`${styles.list} ${styles.compactList}`}>
                {admin.pendingCases.map((serviceCase) => (
                  <Link
                    className={styles.listItem}
                    href={`/app/finance/cases/${serviceCase.id}`}
                    key={serviceCase.id}
                  >
                    <span className={styles.itemCopy}>
                      <strong>{serviceCase.client.displayName}</strong>
                      <small>
                        {serviceCase.vehicle.brand} {serviceCase.vehicle.model}{" "}
                        · {money.format(serviceCase.balance.toNumber())}
                      </small>
                    </span>
                    <ArrowRightIcon aria-hidden size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.plainEmpty}>
                Sin saldos conocidos pendientes.
              </p>
            )}
          </DashboardSection>
          <DashboardSection
            count={admin.undefinedAmountCases.length}
            eyebrow="Definición comercial"
            title="Importe por definir"
          >
            {admin.undefinedAmountCases.length ? (
              <div className={`${styles.list} ${styles.compactList}`}>
                {admin.undefinedAmountCases.map((serviceCase) => (
                  <Link
                    className={styles.listItem}
                    href={`/app/finance/cases/${serviceCase.id}`}
                    key={serviceCase.id}
                  >
                    <span className={styles.itemCopy}>
                      <strong>{serviceCase.client.displayName}</strong>
                      <small>
                        {serviceCase.vehicle.brand} {serviceCase.vehicle.model}
                      </small>
                    </span>
                    <ArrowRightIcon aria-hidden size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.plainEmpty}>
                Todos los trabajos tienen importe definido.
              </p>
            )}
          </DashboardSection>
        </div>
      ) : null}

      {admin?.expiredQuotes.length ? (
        <DashboardSection
          className={styles.alertSection}
          count={admin.expiredQuotes.length}
          eyebrow="Seguimiento"
          title="Presupuestos vencidos"
        >
          <div className={`${styles.list} ${styles.compactList}`}>
            {admin.expiredQuotes.map((quote) => (
              <Link
                className={styles.listItem}
                href={`/app/quotes/${quote.id}`}
                key={quote.id}
              >
                <span className={styles.itemCopy}>
                  <strong>{quote.number}</strong>
                  <small>{quote.client.displayName}</small>
                </span>
                <ArrowRightIcon aria-hidden size={16} />
              </Link>
            ))}
          </div>
        </DashboardSection>
      ) : null}
    </div>
  );
}

function Kpi({
  attention = false,
  detail,
  label,
  primary = false,
  value,
}: {
  attention?: boolean;
  detail: string;
  label: string;
  primary?: boolean;
  value: string;
}) {
  return (
    <article
      className={`${styles.kpi} ${primary ? styles.kpiPrimary : ""} ${attention ? styles.kpiAttention : ""}`}
    >
      <span className={styles.kpiLabel}>{label}</span>
      <strong className={styles.kpiValue}>{value}</strong>
      <small className={styles.kpiDetail}>{detail}</small>
    </article>
  );
}

function DashboardSection({
  children,
  className,
  count,
  eyebrow,
  href,
  link,
  title,
}: {
  children: ReactNode;
  className?: string;
  count?: number;
  eyebrow: string;
  href?: string;
  link?: string;
  title: string;
}) {
  return (
    <section className={`${styles.section} ${className ?? ""}`}>
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {href ? (
          <Link className={styles.sectionLink} href={href}>
            {link}
            <ArrowRightIcon aria-hidden size={14} />
          </Link>
        ) : (
          <span aria-label={`${count ?? 0} elementos`} className={styles.count}>
            {count ?? 0}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function DashboardEmpty({ text, title }: { text: string; title: string }) {
  return (
    <div className={styles.empty}>
      <CarProfileIcon aria-hidden size={22} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
