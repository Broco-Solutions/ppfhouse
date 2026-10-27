export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires" as const;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getBusinessDateKey(instant: Date): string {
  const parts = dateKeyFormatter.formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function formatBusinessDateTime(
  instant: Date,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(instant);
}

const zonedPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(instant: Date) {
  const values = Object.fromEntries(
    zonedPartsFormatter
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function businessLocalDateTimeToUtc(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("INVALID_LOCAL_DATETIME");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = zonedParts(new Date(guess));
    const renderedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess += targetAsUtc - renderedAsUtc;
  }

  const result = new Date(guess);
  const rendered = zonedParts(result);
  if (
    rendered.year !== year ||
    rendered.month !== month ||
    rendered.day !== day ||
    rendered.hour !== hour ||
    rendered.minute !== minute
  ) {
    throw new Error("NON_EXISTENT_LOCAL_DATETIME");
  }
  return result;
}

export function addCivilDays(dateKey: string, days: number): string {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

export function businessDayRange(dateKey: string) {
  return {
    start: businessLocalDateTimeToUtc(`${dateKey}T00:00`),
    end: businessLocalDateTimeToUtc(`${addCivilDays(dateKey, 1)}T00:00`),
  };
}

export function businessMonthRange(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error("INVALID_MONTH_KEY");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("INVALID_MONTH_KEY");
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  return {
    start: businessLocalDateTimeToUtc(`${monthKey}-01T00:00`),
    end: businessLocalDateTimeToUtc(`${next}-01T00:00`),
  };
}

export function getBusinessMonthKey(instant: Date) {
  return getBusinessDateKey(instant).slice(0, 7);
}

export function formatBusinessTime(instant: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}

export function formatBusinessDateTimeInput(instant: Date): string {
  const parts = zonedParts(instant);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatBusinessDate(
  instant: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    ...options,
  }).format(instant);
}
