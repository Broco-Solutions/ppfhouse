import { z } from "zod";

const quantityBase = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,3})?$/, "Usá hasta 3 decimales.")
  .refine((value) => Number(value) > 0, "La cantidad debe ser mayor a cero.");

const reason = z.string().trim().min(3).max(300);

export const addConsumptionSchema = z.object({
  jobId: z.string().uuid(),
  itemId: z.string().uuid(),
  quantityBase,
  note: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => value || undefined),
  idempotencyKey: z.string().uuid(),
});

export const correctConsumptionSchema = z.object({
  consumptionId: z.string().uuid(),
  quantityBase,
  reason,
  idempotencyKey: z.string().uuid(),
});

export const reverseConsumptionSchema = z.object({
  consumptionId: z.string().uuid(),
  reason,
});

export type AddConsumptionInput = z.input<typeof addConsumptionSchema>;
export type CorrectConsumptionInput = z.input<typeof correctConsumptionSchema>;
