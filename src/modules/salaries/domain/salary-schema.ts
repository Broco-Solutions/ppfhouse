import { z } from "zod";

// Accept the decimal comma used in Argentina; grouping separators are ambiguous.
export const salaryAmountSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,12}(?:\.\d{1,2})?$/,
        "Ingresá un importe sin separadores de miles y con hasta 2 decimales.",
      ),
  )
  .refine((value) => Number(value) > 0, "El importe debe ser mayor a cero.");
export const salaryMonthSchema = z
  .string()
  .regex(
    /^[2-9]\d{3}-(?:0[1-9]|1[0-2])$/,
    "Seleccioná un mes válido, desde el año 2000.",
  );
const version = z.coerce.number().int().nonnegative();
export const createSalarySchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre de la persona.").max(120),
  amount: salaryAmountSchema,
  month: salaryMonthSchema,
  idempotencyKey: z.string().uuid(),
});
export const adjustSalarySchema = z.object({
  salaryId: z.string().uuid(),
  month: salaryMonthSchema,
  amount: salaryAmountSchema,
  scope: z.enum(["MONTH", "RECURRING"]),
  version,
});
export const stopSalarySchema = z.object({
  salaryId: z.string().uuid(),
  month: salaryMonthSchema,
  version,
});
export const cancelSalaryMonthSchema = z.object({
  salaryId: z.string().uuid(),
  month: salaryMonthSchema,
  version,
  reason: z
    .string()
    .trim()
    .min(3, "Indicá el motivo de la anulación.")
    .max(300),
});
export const paySalarySchema = z.object({
  salaryId: z.string().uuid(),
  month: salaryMonthSchema,
  version,
  occurredLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indicá fecha y hora del pago."),
  paymentMethod: z.enum(["TRANSFER", "CASH", "OTHER"]),
  idempotencyKey: z.string().uuid(),
});

export function nextSalaryMonth(month: string): string {
  salaryMonthSchema.parse(month);
  const next = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1),
  );
  return next.toISOString().slice(0, 7);
}

export function salaryMonthsBetween(start: string, end: string): string[] {
  salaryMonthSchema.parse(start);
  salaryMonthSchema.parse(end);
  const months: string[] = [];
  for (let month = start; month <= end; month = nextSalaryMonth(month))
    months.push(month);
  return months;
}
