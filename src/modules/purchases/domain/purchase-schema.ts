import { z } from "zod";

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const positiveQuantity = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,3})?$/, "Usá hasta 3 decimales.")
  .refine((value) => Number(value) > 0, "La cantidad debe ser positiva.");

const positiveMoney = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Usá hasta 2 decimales.")
  .refine((value) => Number(value) > 0, "El costo debe ser positivo.");

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactName: optionalText(120),
  phone: optionalText(60),
  email: z
    .string()
    .trim()
    .email("Ingresá un email válido.")
    .optional()
    .or(z.literal(""))
    .transform((value) => value?.toLowerCase() || undefined),
  notes: optionalText(1_000),
});

export const purchaseInputSchema = z
  .object({
    currency: z.enum(["USD", "ARS"]).default("USD"),
    exchangeRateArsPerUsd: z.string().optional().or(z.literal("")),
    supplierId: z.string().uuid(),
    businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reference: optionalText(120),
    notes: optionalText(1_000),
    idempotencyKey: z.string().uuid(),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          presentationId: z.string().uuid().optional().or(z.literal("")),
          quantityPurchased: positiveQuantity,
          unitCostUsd: positiveMoney,
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((value, context) => {
    if (
      value.currency === "ARS" &&
      (!/^\d{1,12}(?:\.\d{1,6})?$/.test(value.exchangeRateArsPerUsd ?? "") ||
        /^0(?:\.0+)?$/.test(value.exchangeRateArsPerUsd ?? ""))
    ) {
      context.addIssue({
        code: "custom",
        path: ["exchangeRateArsPerUsd"],
        message: "Ingresá una cotización ARS/USD mayor a cero.",
      });
    }
  });

export type PurchaseInput = z.input<typeof purchaseInputSchema>;
