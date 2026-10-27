import { z } from "zod";
import { moneyInputSchema } from "@/modules/money/domain/schema";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

export const financialEntryInputSchema = z
  .object({
    kind: z.enum([
      "CUSTOMER_PAYMENT",
      "CUSTOMER_REFUND",
      "MANUAL_INCOME",
      "MANUAL_EXPENSE",
    ]),
    ...moneyInputSchema.shape,
    occurredLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    serviceCaseId: z.string().uuid().optional().or(z.literal("")),
    categoryId: z.string().uuid().optional().or(z.literal("")),
    paymentMethod: z
      .enum(["TRANSFER", "CASH", "OTHER"])
      .optional()
      .or(z.literal("")),
    description: optionalText(500),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (/^0(?:\.0+)?$/.test(value.amount)) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: "El monto debe ser mayor a cero.",
      });
    }
    if (value.kind.startsWith("CUSTOMER_") && !value.serviceCaseId) {
      context.addIssue({
        code: "custom",
        path: ["serviceCaseId"],
        message: "Seleccioná el trabajo o servicio al que corresponde.",
      });
    }
    if (value.kind.startsWith("MANUAL_") && !value.categoryId) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Seleccioná una categoría.",
      });
    }
  });

export const amountRevisionSchema = z.object({
  serviceCaseId: z.string().uuid(),
  ...moneyInputSchema.shape,
  reason: z.string().trim().min(3, "Explicá brevemente el cambio.").max(300),
});

export const directCostSchema = z
  .object({
    serviceCaseId: z.string().uuid(),
    currency: z.enum(["USD", "ARS"]),
    amount: z
      .string()
      .trim()
      .regex(
        /^$|^\d{1,12}(?:\.\d{1,2})?$/,
        "Ingresá un costo válido con hasta 2 decimales.",
      ),
    exchangeRateArsPerUsd: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.amount && !moneyInputSchema.safeParse(value).success) {
      const parsed = moneyInputSchema.safeParse(value);
      for (const issue of parsed.error?.issues ?? [])
        context.addIssue({ ...issue, path: issue.path });
    }
  });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  direction: z.enum(["INFLOW", "OUTFLOW"]),
});

export type FinancialEntryInput = z.input<typeof financialEntryInputSchema>;
