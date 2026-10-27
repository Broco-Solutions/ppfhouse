export const APPOINTMENT_TONES = [
  "blue",
  "green",
  "amber",
  "red",
  "violet",
  "teal",
  "pink",
  "graphite",
] as const;

export type AppointmentTone = (typeof APPOINTMENT_TONES)[number];

export const APPOINTMENT_TONE_LABELS: Record<AppointmentTone, string> = {
  blue: "Azul",
  green: "Verde",
  amber: "Ámbar",
  red: "Rojo",
  violet: "Violeta",
  teal: "Turquesa",
  pink: "Rosa",
  graphite: "Grafito",
};

export function isAppointmentTone(value: unknown): value is AppointmentTone {
  return (
    typeof value === "string" &&
    (APPOINTMENT_TONES as readonly string[]).includes(value)
  );
}

/** Stored color wins; otherwise a stable tone derived from the appointment id. */
export function resolveAppointmentTone(
  color: string | null | undefined,
  seed: string,
): AppointmentTone {
  if (isAppointmentTone(color)) return color;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return APPOINTMENT_TONES[hash % APPOINTMENT_TONES.length]!;
}
