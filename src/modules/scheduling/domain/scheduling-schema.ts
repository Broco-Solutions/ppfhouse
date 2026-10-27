import { z } from "zod";

import { APPOINTMENT_TONES } from "./appointment-tones";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Elegí fecha y hora.");

export const appointmentInputSchema = z.object({
  clientId: z.string().uuid("Elegí un cliente."),
  vehicleId: z.string().uuid("Elegí un vehículo."),
  startLocal: localDateTime,
  endLocal: localDateTime,
  serviceIds: z.array(z.string().uuid()).max(20).default([]),
  employeeIds: z.array(z.string().uuid()).max(20).default([]),
  internalNotes: z
    .string()
    .trim()
    .max(3_000)
    .transform((value) => value || undefined)
    .optional(),
  visibleToClient: z.boolean().default(true),
  color: z.enum(APPOINTMENT_TONES).nullish(),
  idempotencyKey: z.string().uuid(),
});

export const appointmentEditSchema = appointmentInputSchema.omit({
  idempotencyKey: true,
});

export const calendarBlockInputSchema = z.object({
  reason: z.string().trim().min(2, "Ingresá el motivo.").max(160),
  startLocal: localDateTime,
  endLocal: localDateTime,
  allDay: z.boolean().default(false),
  notes: z
    .string()
    .trim()
    .max(2_000)
    .transform((value) => value || undefined)
    .optional(),
});

export const quoteAppointmentInputSchema = z.object({
  quoteId: z.string().uuid(),
  startLocal: localDateTime,
  endLocal: localDateTime,
  employeeIds: z.array(z.string().uuid()).max(20).default([]),
  internalNotes: z
    .string()
    .trim()
    .max(3_000)
    .transform((value) => value || undefined)
    .optional(),
  visibleToClient: z.boolean().default(true),
  idempotencyKey: z.string().uuid(),
});

export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
export type AppointmentEditInput = z.infer<typeof appointmentEditSchema>;
export type CalendarBlockInput = z.infer<typeof calendarBlockInputSchema>;
export type QuoteAppointmentInput = z.infer<typeof quoteAppointmentInputSchema>;
