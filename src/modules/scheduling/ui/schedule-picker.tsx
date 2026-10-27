"use client";

import { ArrowRightIcon, WarningCircleIcon } from "@phosphor-icons/react";

import { useEffect, useRef } from "react";

import { MiniCalendar } from "./mini-calendar";
import styles from "./schedule-picker.module.css";

export interface ScheduleValue {
  start: string;
  end: string;
}

const START_SLOTS = Array.from(
  { length: 12 },
  (_, index) => `${String(index + 8).padStart(2, "0")}:00`,
);

const DURATIONS = [30, 60, 90, 120, 180, 240, 360, 480, 1_440, 2_880];

function toMs(local: string) {
  return Date.parse(`${local}:00Z`);
}

function fromMs(ms: number) {
  return new Date(ms).toISOString().slice(0, 16);
}

export function minutesBetween({ start, end }: ScheduleValue) {
  return Math.round((toMs(end) - toMs(start)) / 60_000);
}

export function formatDuration(minutes: number) {
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  const parts = [
    days ? `${days} ${days === 1 ? "día" : "días"}` : "",
    hours ? `${hours} h` : "",
    rest ? `${rest} min` : "",
  ].filter(Boolean);
  return parts.join(" ") || "0 min";
}

function formatLocal(local: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${local}:00Z`));
}

export function ScheduleSummary({ value }: { value: ScheduleValue }) {
  const minutes = minutesBetween(value);
  if (!(minutes > 0)) {
    return (
      <span className={styles.summaryInvalid}>
        <WarningCircleIcon aria-hidden size={16} weight="bold" />
        El fin tiene que ser posterior al inicio.
      </span>
    );
  }
  const sameDay = value.start.slice(0, 10) === value.end.slice(0, 10);
  return (
    <span className={styles.summary}>
      <span className={styles.summaryDay}>
        {formatLocal(value.start, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </span>
      <span className={styles.summaryRange}>
        {value.start.slice(11)}
        <ArrowRightIcon aria-hidden size={14} />
        {sameDay
          ? value.end.slice(11)
          : `${formatLocal(value.end, { weekday: "short", day: "numeric" })} ${value.end.slice(11)}`}
      </span>
      <span className={styles.summaryDuration}>{formatDuration(minutes)}</span>
    </span>
  );
}

export function SchedulePicker({
  onChange,
  showSummary = true,
  today,
  value,
}: {
  onChange: (value: ScheduleValue) => void;
  showSummary?: boolean;
  today: string;
  value: ScheduleValue;
}) {
  const startDate = value.start.slice(0, 10);
  const startTime = value.start.slice(11, 16);
  const endDate = value.end.slice(0, 10);
  const endTime = value.end.slice(11, 16);
  const duration = minutesBetween(value);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  // Keep anything typed before hydration instead of resetting it to defaults.
  useEffect(() => {
    const typedStart = startTimeRef.current?.value;
    const typedEndDate = endDateRef.current?.value;
    const typedEndTime = endTimeRef.current?.value;
    if (!typedStart || !typedEndDate || !typedEndTime) return;
    const start = `${value.start.slice(0, 10)}T${typedStart}`;
    const end = `${typedEndDate}T${typedEndTime}`;
    if (start !== value.start || end !== value.end) onChange({ start, end });
    // Mount-only: reconciles the server-rendered inputs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveStart(nextStart: string) {
    const keep = duration > 0 ? duration : 60;
    onChange({
      start: nextStart,
      end: fromMs(toMs(nextStart) + keep * 60_000),
    });
  }

  return (
    <div className={styles.schedule}>
      <input name="startLocal" type="hidden" value={value.start} />
      <input name="endLocal" type="hidden" value={value.end} />

      <div className={styles.scheduleDate}>
        <span className={styles.pickerLabel}>Día</span>
        <MiniCalendar
          label="Día de inicio"
          onChange={(day) => moveStart(`${day}T${startTime}`)}
          today={today}
          value={startDate}
        />
      </div>

      <div className={styles.scheduleTimes}>
        <div className={styles.pickerGroup}>
          <div className={styles.pickerGroupHead}>
            <label className={styles.pickerLabel} htmlFor="schedule-start-time">
              Empieza
            </label>
            <input
              aria-label="Hora de inicio"
              ref={startTimeRef}
              className={styles.timeInput}
              id="schedule-start-time"
              onChange={(event) => {
                if (event.target.value)
                  moveStart(`${startDate}T${event.target.value}`);
              }}
              step={900}
              type="time"
              value={startTime}
            />
          </div>
          <div
            aria-label="Horarios frecuentes"
            className={styles.chips}
            role="group"
          >
            {START_SLOTS.map((slot) => (
              <button
                aria-pressed={slot === startTime}
                className={styles.chip}
                key={slot}
                onClick={() => moveStart(`${startDate}T${slot}`)}
                type="button"
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.pickerGroup}>
          <span className={styles.pickerLabel}>Duración</span>
          <div aria-label="Duración" className={styles.chips} role="group">
            {DURATIONS.map((minutes) => (
              <button
                aria-pressed={minutes === duration}
                className={styles.chip}
                key={minutes}
                onClick={() =>
                  onChange({
                    start: value.start,
                    end: fromMs(toMs(value.start) + minutes * 60_000),
                  })
                }
                type="button"
              >
                {formatDuration(minutes)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.pickerGroup}>
          <span className={styles.pickerLabel}>Termina</span>
          <div className={styles.endFields}>
            <input
              aria-label="Fecha de fin"
              ref={endDateRef}
              className={styles.dateInput}
              min={startDate}
              onChange={(event) => {
                if (event.target.value)
                  onChange({
                    start: value.start,
                    end: `${event.target.value}T${endTime}`,
                  });
              }}
              type="date"
              value={endDate}
            />
            <input
              aria-label="Hora de fin"
              ref={endTimeRef}
              className={styles.timeInput}
              onChange={(event) => {
                if (event.target.value)
                  onChange({
                    start: value.start,
                    end: `${endDate}T${event.target.value}`,
                  });
              }}
              step={900}
              type="time"
              value={endTime}
            />
          </div>
        </div>

        {showSummary ? (
          <p aria-live="polite" className={styles.summaryLine}>
            <ScheduleSummary value={value} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
