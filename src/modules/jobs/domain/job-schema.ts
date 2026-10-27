import { z } from "zod";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Elegí fecha y hora.");

const sharedJobFields = {
  performedLocal: localDateTime,
  serviceIds: z.array(z.string().uuid()).max(30).default([]),
  employeeIds: z.array(z.string().uuid()).max(20).default([]),
  notes: z
    .string()
    .trim()
    .max(4_000)
    .transform((value) => value || undefined)
    .optional(),
};

export const completeAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  ...sharedJobFields,
});

export const directJobSchema = z.object({
  clientId: z.string().uuid("Elegí un cliente."),
  vehicleId: z.string().uuid("Elegí un vehículo."),
  idempotencyKey: z.string().uuid(),
  ...sharedJobFields,
});

export const voidJobSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.string().trim().min(4, "Explicá brevemente el motivo.").max(500),
});

export type CompleteAppointmentInput = z.infer<
  typeof completeAppointmentSchema
>;
export type DirectJobInput = z.infer<typeof directJobSchema>;
