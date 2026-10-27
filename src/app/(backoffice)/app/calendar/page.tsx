import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CheckCircleIcon,
  PlusIcon,
  ProhibitIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { cancelCalendarBlockAction } from "@/modules/scheduling/application/actions";
import { getCalendarRange } from "@/modules/scheduling/application/scheduling-service";
import { resolveAppointmentTone } from "@/modules/scheduling/domain/appointment-tones";
import styles from "@/modules/scheduling/ui/calendar.module.css";
import { CalendarDateField } from "@/modules/scheduling/ui/date-field";
import { DayTimelineScroller } from "@/modules/scheduling/ui/day-timeline-scroller";
import {
  addCivilDays,
  businessDayRange,
  formatBusinessDateTimeInput,
  formatBusinessTime,
  getBusinessDateKey,
} from "@/shared/date-time/business-time";

export const metadata: Metadata = { title: "Agenda" };

type View = "day" | "week" | "month";
type CalendarRange = Awaited<ReturnType<typeof getCalendarRange>>;
type Appointment = CalendarRange["appointments"][number];
type CalendarBlock = CalendarRange["blocks"][number];
type TimelineEntry =
  | { kind: "appointment"; appointment: Appointment; start: Date; end: Date }
  | { kind: "block"; block: CalendarBlock; start: Date; end: Date };
type TimelineStyle = CSSProperties & {
  "--event-height": string;
  "--event-lane": number;
  "--event-lanes": number;
  "--event-top": string;
};

const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;
const DAY_DURATION_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;

function safeDateKey(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : getBusinessDateKey(new Date());
}

function weekStart(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  return addCivilDays(dateKey, 1 - weekday);
}

function monthStart(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

function nextMonth(dateKey: string, offset: number) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  return new Date(Date.UTC(year, month - 1 + offset, 1))
    .toISOString()
    .slice(0, 10);
}

function viewConfig(view: View, dateKey: string) {
  if (view === "day") {
    return {
      startKey: dateKey,
      endKey: addCivilDays(dateKey, 1),
      days: [dateKey],
      previous: addCivilDays(dateKey, -1),
      next: addCivilDays(dateKey, 1),
      monthKey: dateKey.slice(0, 7),
    };
  }

  if (view === "week") {
    const startKey = weekStart(dateKey);
    return {
      startKey,
      endKey: addCivilDays(startKey, 7),
      days: Array.from({ length: 7 }, (_, index) =>
        addCivilDays(startKey, index),
      ),
      previous: addCivilDays(dateKey, -7),
      next: addCivilDays(dateKey, 7),
      monthKey: dateKey.slice(0, 7),
    };
  }

  const activeMonthStart = monthStart(dateKey);
  const gridStart = weekStart(activeMonthStart);
  return {
    startKey: gridStart,
    endKey: addCivilDays(gridStart, 42),
    days: Array.from({ length: 42 }, (_, index) =>
      addCivilDays(gridStart, index),
    ),
    previous: nextMonth(activeMonthStart, -1),
    next: nextMonth(activeMonthStart, 1),
    monthKey: activeMonthStart.slice(0, 7),
  };
}

function formatDay(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function periodCopy(view: View, dateKey: string, days: string[]) {
  if (view === "day") {
    return {
      title: formatDay(dateKey, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      detail: String(dateKey.slice(0, 4)),
    };
  }
  if (view === "week") {
    return {
      title: `${formatDay(days[0]!, { day: "numeric", month: "short" })} – ${formatDay(days[6]!, { day: "numeric", month: "short" })}`,
      detail: `Semana · ${dateKey.slice(0, 4)}`,
    };
  }
  return {
    title: formatDay(`${dateKey.slice(0, 7)}-01`, {
      month: "long",
      year: "numeric",
    }),
    detail: "Mes completo",
  };
}

function entriesForDay(
  day: string,
  appointments: Appointment[],
  blocks: CalendarBlock[],
) {
  const range = businessDayRange(day);
  return {
    dayAppointments: appointments.filter(
      (item) => item.startAt < range.end && item.endAt > range.start,
    ),
    dayBlocks: blocks.filter(
      (item) => item.startAt < range.end && item.endAt > range.start,
    ),
  };
}

function minuteOfDay(instant: Date) {
  const local = formatBusinessDateTimeInput(instant);
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

function durationLabel(start: Date, end: Date) {
  const minutes = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function layoutTimeline(entries: TimelineEntry[]) {
  const sorted = [...entries].sort(
    (left, right) => left.start.getTime() - right.start.getTime(),
  );
  const result: Array<TimelineEntry & { lane: number; lanes: number }> = [];
  let index = 0;

  while (index < sorted.length) {
    const first = sorted[index]!;
    const cluster: TimelineEntry[] = [first];
    let clusterEnd = first.end.getTime();
    let cursor = index + 1;
    while (
      cursor < sorted.length &&
      sorted[cursor]!.start.getTime() < clusterEnd
    ) {
      const next = sorted[cursor]!;
      cluster.push(next);
      clusterEnd = Math.max(clusterEnd, next.end.getTime());
      cursor += 1;
    }

    const laneEnds: number[] = [];
    const assigned = cluster.map((entry) => {
      const available = laneEnds.findIndex(
        (end) => end <= entry.start.getTime(),
      );
      const lane = available === -1 ? laneEnds.length : available;
      laneEnds[lane] = entry.end.getTime();
      return { ...entry, lane };
    });
    result.push(
      ...assigned.map((entry) => ({ ...entry, lanes: laneEnds.length })),
    );
    index = cursor;
  }

  return result;
}

function timelineStyle(
  entry: TimelineEntry & { lane: number; lanes: number },
  day: string,
) {
  const start =
    getBusinessDateKey(entry.start) === day
      ? Math.max(DAY_START_MINUTES, minuteOfDay(entry.start))
      : DAY_START_MINUTES;
  const end =
    getBusinessDateKey(entry.end) === day
      ? Math.min(DAY_END_MINUTES, minuteOfDay(entry.end))
      : DAY_END_MINUTES;
  const visibleEnd = Math.max(end, start + 15);
  return {
    "--event-top": `${((start - DAY_START_MINUTES) / DAY_DURATION_MINUTES) * 100}%`,
    "--event-height": `${((visibleEnd - start) / DAY_DURATION_MINUTES) * 100}%`,
    "--event-lane": entry.lane,
    "--event-lanes": entry.lanes,
  } satisfies TimelineStyle;
}

function appointmentStatus(status: Appointment["status"]) {
  if (status === "COMPLETED") {
    return { label: "Realizado", Icon: CheckCircleIcon };
  }
  if (status === "CANCELLED") {
    return { label: "Cancelado", Icon: XCircleIcon };
  }
  return { label: "Confirmado", Icon: CalendarCheckIcon };
}

function statusClassName(status: Appointment["status"]) {
  if (status === "CANCELLED") return styles.eventCancelled;
  if (status === "COMPLETED") return styles.eventCompleted;
  return "";
}

function TimelineAppointment({
  appointment,
  style,
}: {
  appointment: Appointment;
  style: TimelineStyle;
}) {
  const status = appointmentStatus(appointment.status);
  const vehicle = appointment.serviceCase.vehicle;
  const className = `${styles.event} ${styles.toned} ${statusClassName(appointment.status)}`;

  return (
    <Link
      aria-label={`${formatBusinessTime(appointment.startAt)} a ${formatBusinessTime(appointment.endAt)}, ${vehicle.brand} ${vehicle.model}, ${status.label}`}
      className={className}
      data-tone={resolveAppointmentTone(appointment.color, appointment.id)}
      href={`/app/calendar/${appointment.id}`}
      style={style}
    >
      <span className={styles.eventTopline}>
        <time dateTime={appointment.startAt.toISOString()}>
          {formatBusinessTime(appointment.startAt)}–
          {formatBusinessTime(appointment.endAt)}
        </time>
        <span className={styles.status}>
          <status.Icon aria-hidden size={14} weight="bold" />
          {status.label}
        </span>
      </span>
      <span className={styles.eventIdentity}>
        <span aria-hidden className={styles.toneDot} />
        <strong>
          {vehicle.brand} {vehicle.model}
        </strong>
      </span>
      <span className={styles.eventMeta}>
        <span>
          {appointment.serviceCase.client.displayName} ·{" "}
          {durationLabel(appointment.startAt, appointment.endAt)}
        </span>
      </span>
      <span className={styles.eventMeta}>
        <span>
          {appointment.services[0]?.nameSnapshot ?? "Sin servicio definido"}
          {appointment.services.length > 1
            ? ` +${appointment.services.length - 1}`
            : ""}
        </span>
      </span>
    </Link>
  );
}

function TimelineBlock({
  block,
  style,
}: {
  block: CalendarBlock;
  style: TimelineStyle;
}) {
  return (
    <article
      aria-label={`Bloqueo, ${block.reason}, ${formatBusinessTime(block.startAt)} a ${formatBusinessTime(block.endAt)}`}
      className={`${styles.event} ${styles.eventBlock}`}
      style={style}
    >
      <span className={styles.eventTopline}>
        <time dateTime={block.startAt.toISOString()}>
          {formatBusinessTime(block.startAt)}–{formatBusinessTime(block.endAt)}
        </time>
        <span className={styles.status}>
          <ProhibitIcon aria-hidden size={14} weight="bold" /> Bloqueo
        </span>
      </span>
      <span className={styles.eventIdentity}>
        <strong>{block.reason}</strong>
      </span>
      <form action={cancelCalendarBlockAction}>
        <input name="id" type="hidden" value={block.id} />
        <ConfirmButton
          className={styles.cancelBlock}
          message="¿Cancelar este bloqueo de agenda?"
        >
          Cancelar
        </ConfirmButton>
      </form>
    </article>
  );
}

function DayTimeline({
  appointments,
  blocks,
  day,
  selected,
}: {
  appointments: Appointment[];
  blocks: CalendarBlock[];
  day: string;
  selected: boolean;
}) {
  const { dayAppointments, dayBlocks } = entriesForDay(
    day,
    appointments,
    blocks,
  );
  const allDayBlocks = dayBlocks.filter((block) => block.allDay);
  const timedEntries: TimelineEntry[] = [
    ...dayAppointments.map((appointment) => ({
      kind: "appointment" as const,
      appointment,
      start: appointment.startAt,
      end: appointment.endAt,
    })),
    ...dayBlocks
      .filter((block) => !block.allDay)
      .map((block) => ({
        kind: "block" as const,
        block,
        start: block.startAt,
        end: block.endAt,
      })),
  ];
  const positioned = layoutTimeline(timedEntries);

  return (
    <section aria-label={`Agenda del ${day}`}>
      {allDayBlocks.length ? (
        <div className={styles.allDay}>
          <span className={styles.allDayLabel}>Todo el día</span>
          <div className={styles.allDayItems}>
            {allDayBlocks.map((block) => (
              <span className={styles.blockChip} key={block.id}>
                <ProhibitIcon aria-hidden size={16} />
                Bloqueo · {block.reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <header className={styles.dayHeader}>
        <div className={styles.dayHeaderCopy}>
          <span>{formatDay(day, { weekday: "long" })}</span>
          <strong>{formatDay(day, { day: "numeric", month: "long" })}</strong>
        </div>
        {selected ? (
          <span className={styles.selectedLabel}>Seleccionado</span>
        ) : null}
      </header>
      <DayTimelineScroller day={day}>
        <div className={styles.timeline}>
          <div aria-hidden className={styles.timeRail}>
            {Array.from({ length: 25 }, (_, index) => (
              <span
                className={styles.timeLabel}
                data-calendar-hour={index}
                key={index}
                style={
                  {
                    "--time-top": `${(index / 24) * 100}%`,
                  } as CSSProperties
                }
              >
                {String(index).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <div className={styles.timelineCanvas}>
            {positioned.map((entry) =>
              entry.kind === "appointment" ? (
                <TimelineAppointment
                  appointment={entry.appointment}
                  key={`appointment-${entry.appointment.id}`}
                  style={timelineStyle(entry, day)}
                />
              ) : (
                <TimelineBlock
                  block={entry.block}
                  key={`block-${entry.block.id}`}
                  style={timelineStyle(entry, day)}
                />
              ),
            )}
            {!positioned.length ? (
              <div className={styles.emptyDay}>
                <CalendarBlankIcon aria-hidden size={28} />
                <strong>Sin actividad en este día</strong>
                <span>El horario está disponible para nuevos turnos.</span>
              </div>
            ) : null}
          </div>
        </div>
      </DayTimelineScroller>
    </section>
  );
}

function WeekEvent({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <span className={`${styles.weekEvent} ${styles.weekEventBlock}`}>
      <span className={styles.status}>
        {icon}
        {children}
      </span>
    </span>
  );
}

function WeekView({
  appointments,
  blocks,
  dateKey,
  days,
}: {
  appointments: Appointment[];
  blocks: CalendarBlock[];
  dateKey: string;
  days: string[];
}) {
  return (
    <div
      aria-label="Semana desplazable"
      className={styles.weekScroller}
      role="region"
      tabIndex={0}
    >
      <div className={styles.weekGrid}>
        {days.map((day) => {
          const { dayAppointments, dayBlocks } = entriesForDay(
            day,
            appointments,
            blocks,
          );
          return (
            <section
              className={`${styles.weekDay} ${day === dateKey ? styles.weekDaySelected : ""}`}
              key={day}
            >
              <header className={styles.weekHeader}>
                <span>{formatDay(day, { weekday: "short" })}</span>
                <strong>{Number(day.slice(-2))}</strong>
              </header>
              <div className={styles.weekEntries}>
                {dayBlocks.map((block) => (
                  <WeekEvent
                    icon={<ProhibitIcon aria-hidden size={14} />}
                    key={block.id}
                  >
                    {block.allDay
                      ? "Todo el día"
                      : formatBusinessTime(block.startAt)}{" "}
                    · Bloqueo
                    <strong>{block.reason}</strong>
                  </WeekEvent>
                ))}
                {dayAppointments.map((appointment) => {
                  const status = appointmentStatus(appointment.status);
                  return (
                    <Link
                      className={`${styles.weekEvent} ${styles.toned} ${statusClassName(appointment.status)}`}
                      data-tone={resolveAppointmentTone(
                        appointment.color,
                        appointment.id,
                      )}
                      href={`/app/calendar/${appointment.id}`}
                      key={appointment.id}
                    >
                      <span className={styles.eventTopline}>
                        <time dateTime={appointment.startAt.toISOString()}>
                          {formatBusinessTime(appointment.startAt)}
                        </time>
                        <span className={styles.status}>
                          <status.Icon aria-hidden size={13} />
                          {status.label}
                        </span>
                      </span>
                      <strong>
                        {appointment.serviceCase.vehicle.brand}{" "}
                        {appointment.serviceCase.vehicle.model}
                      </strong>
                      <span>{appointment.serviceCase.client.displayName}</span>
                      <span>
                        {durationLabel(appointment.startAt, appointment.endAt)}
                      </span>
                    </Link>
                  );
                })}
                {!dayBlocks.length && !dayAppointments.length ? (
                  <p className={styles.weekEmpty}>Sin actividad</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  appointments,
  blocks,
  dateKey,
  days,
  monthKey,
}: {
  appointments: Appointment[];
  blocks: CalendarBlock[];
  dateKey: string;
  days: string[];
  monthKey: string;
}) {
  return (
    <>
      <div aria-hidden className={styles.monthWeekdays}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {days.map((day) => {
          const { dayAppointments, dayBlocks } = entriesForDay(
            day,
            appointments,
            blocks,
          );
          const entries = [
            ...dayBlocks.map((block) => ({
              id: `block-${block.id}`,
              label: `Bloqueo · ${block.reason}`,
              href: `/app/calendar?view=day&date=${day}`,
              tone: undefined,
              className: styles.monthEventBlock,
            })),
            ...dayAppointments.map((appointment) => ({
              id: `appointment-${appointment.id}`,
              label: `${formatBusinessTime(appointment.startAt)} ${appointment.serviceCase.vehicle.model}`,
              href: `/app/calendar/${appointment.id}`,
              tone: resolveAppointmentTone(appointment.color, appointment.id),
              className: `${styles.toned} ${statusClassName(appointment.status)}`,
            })),
          ];
          return (
            <section
              aria-label={formatDay(day, { dateStyle: "full" })}
              className={`${styles.monthCell} ${day.slice(0, 7) !== monthKey ? styles.monthCellOutside : ""}`}
              key={day}
            >
              <Link
                className={`${styles.monthDate} ${day === dateKey ? styles.monthDateSelected : ""}`}
                href={`/app/calendar?view=day&date=${day}`}
              >
                <span className="sr-only">
                  {formatDay(day, { weekday: "long", month: "long" })}
                </span>
                {Number(day.slice(-2))}
              </Link>
              <div className={styles.monthEvents}>
                {entries.slice(0, 3).map((entry) => (
                  <Link
                    className={`${styles.monthEvent} ${entry.className}`}
                    data-tone={entry.tone}
                    href={entry.href}
                    key={entry.id}
                  >
                    {entry.label}
                  </Link>
                ))}
                {entries.length > 3 ? (
                  <p className={styles.moreEvents}>+{entries.length - 3} más</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    blockSaved?: string;
    date?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const view: View =
    params.view === "week" || params.view === "month" ? params.view : "day";
  const dateKey = safeDateKey(params.date);
  const config = viewConfig(view, dateKey);
  const data = await getCalendarRange(
    businessDayRange(config.startKey).start,
    businessDayRange(config.endKey).start,
  );
  const today = getBusinessDateKey(new Date());
  const period = periodCopy(view, dateKey, config.days);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Centro operativo</p>
          <h1>Agenda</h1>
          <p className={styles.description}>
            Tiempo, duración y estado de cada vehículo en una sola lectura.
          </p>
        </div>
        <div className={styles.actions}>
          <Link
            className={styles.button}
            href={`/app/calendar/blocks/new?date=${dateKey}`}
          >
            <ProhibitIcon aria-hidden size={18} /> Bloquear
          </Link>
          <Link
            className={styles.buttonPrimary}
            href={`/app/calendar/new?date=${dateKey}`}
          >
            <PlusIcon aria-hidden size={18} weight="bold" /> Nuevo turno
          </Link>
        </div>
      </header>

      {params.blockSaved ? (
        <p className={styles.notice} role="status">
          <CheckCircleIcon aria-hidden size={20} weight="bold" /> Bloqueo creado
          correctamente.
        </p>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.dateNavigation}>
          <Link
            aria-label="Período anterior"
            className={styles.toolbarLink}
            href={`/app/calendar?view=${view}&date=${config.previous}`}
          >
            <ArrowLeftIcon aria-hidden size={18} />
          </Link>
          <div aria-live="polite" className={styles.periodLabel}>
            <strong>{period.title}</strong>
            <span>{period.detail}</span>
          </div>
          <Link
            aria-label="Período siguiente"
            className={styles.toolbarLink}
            href={`/app/calendar?view=${view}&date=${config.next}`}
          >
            <ArrowRightIcon aria-hidden size={18} />
          </Link>
          <Link
            aria-label="Ir a hoy"
            className={styles.toolbarLink}
            href={`/app/calendar?view=${view}&date=${today}`}
          >
            Hoy
          </Link>
          <CalendarDateField
            className={styles.datePickerButton}
            date={dateKey}
            today={today}
            view={view}
          />
        </div>
        <nav aria-label="Vista de agenda" className={styles.viewSwitcher}>
          {(["day", "week", "month"] as const).map((item) => (
            <Link
              aria-current={view === item ? "page" : undefined}
              className={`${styles.viewLink} ${view === item ? styles.viewLinkActive : ""}`}
              href={`/app/calendar?view=${item}&date=${dateKey}`}
              key={item}
            >
              {item === "day" ? "Día" : item === "week" ? "Semana" : "Mes"}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.calendarSurface}>
        {view === "day" ? (
          <DayTimeline
            appointments={data.appointments}
            blocks={data.blocks}
            day={dateKey}
            selected
          />
        ) : view === "week" ? (
          <WeekView
            appointments={data.appointments}
            blocks={data.blocks}
            dateKey={dateKey}
            days={config.days}
          />
        ) : (
          <MonthView
            appointments={data.appointments}
            blocks={data.blocks}
            dateKey={dateKey}
            days={config.days}
            monthKey={config.monthKey}
          />
        )}
      </div>
    </div>
  );
}
