"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { addCivilDays } from "@/shared/date-time/business-time";

import styles from "./schedule-picker.module.css";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function shiftMonth(monthKey: string, offset: number) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  return new Date(Date.UTC(year, month - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

function gridDays(monthKey: string) {
  const first = `${monthKey}-01`;
  const weekday =
    new Date(`${first}T12:00:00Z`).getUTCDay() || 7; /* Monday-first */
  const start = addCivilDays(first, 1 - weekday);
  return Array.from({ length: 42 }, (_, index) => addCivilDays(start, index));
}

function format(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function MiniCalendar({
  autoFocus = false,
  label = "Calendario",
  onChange,
  today,
  value,
}: {
  autoFocus?: boolean;
  label?: string;
  onChange: (dateKey: string) => void;
  today: string;
  value: string;
}) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const [focused, setFocused] = useState(value);
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocus = useRef(autoFocus);

  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setMonth(value.slice(0, 7));
    setFocused(value);
  }

  useEffect(() => {
    if (!shouldFocus.current) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
      ?.focus();
  }, [focused, month]);

  function moveFocus(next: string) {
    shouldFocus.current = true;
    setFocused(next);
    if (next.slice(0, 7) !== month) setMonth(next.slice(0, 7));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in steps) {
      event.preventDefault();
      moveFocus(addCivilDays(focused, steps[event.key]!));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const target = shiftMonth(
        focused.slice(0, 7),
        event.key === "PageUp" ? -1 : 1,
      );
      const day = Math.min(Number(focused.slice(8, 10)), 28);
      moveFocus(`${target}-${String(day).padStart(2, "0")}`);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(`${month}-01`);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(addCivilDays(`${shiftMonth(month, 1)}-01`, -1));
    }
  }

  const days = gridDays(month);

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <button
          aria-label="Mes anterior"
          className={styles.calendarNav}
          onClick={() => setMonth(shiftMonth(month, -1))}
          type="button"
        >
          <CaretLeftIcon aria-hidden size={16} weight="bold" />
        </button>
        <strong aria-live="polite" className={styles.calendarTitle}>
          {format(`${month}-01`, { month: "long", year: "numeric" })}
        </strong>
        <button
          aria-label="Mes siguiente"
          className={styles.calendarNav}
          onClick={() => setMonth(shiftMonth(month, 1))}
          type="button"
        >
          <CaretRightIcon aria-hidden size={16} weight="bold" />
        </button>
      </div>
      <div aria-hidden className={styles.calendarWeekdays}>
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        aria-label={label}
        className={styles.calendarGrid}
        onBlur={() => {
          shouldFocus.current = false;
        }}
        onKeyDown={onKeyDown}
        ref={gridRef}
        role="group"
      >
        {days.map((day) => {
          const outside = day.slice(0, 7) !== month;
          const isFocusable =
            focused.slice(0, 7) === month
              ? day === focused
              : day === `${month}-01`;
          return (
            <button
              aria-current={day === today ? "date" : undefined}
              aria-label={format(day, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              aria-pressed={day === value}
              className={styles.calendarDay}
              data-date={day}
              data-outside={outside || undefined}
              key={day}
              onClick={() => {
                setFocused(day);
                onChange(day);
              }}
              tabIndex={isFocusable ? 0 : -1}
              type="button"
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
