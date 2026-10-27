import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha.");
const decimal = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,3})?$/, "Ingresá un valor válido.");
const money = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Ingresá un importe válido.");
const optionalUuid = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .pipe(z.string().uuid().optional());

export const quoteItemSchema = z.object({
  serviceId: optionalUuid,
  name: z.string().trim().min(2, "Ingresá el nombre del ítem.").max(180),
  description: z
    .string()
    .trim()
    .max(1_500)
    .transform((value) => value || undefined)
    .optional(),
  quantity: decimal,
  unitPriceUsd: money,
  discountUsd: money.default("0"),
});

export const quoteInputSchema = z
  .object({
    currency: z.enum(["USD", "ARS"]).default("USD"),
    exchangeRateArsPerUsd: z.string().optional().or(z.literal("")),
    clientId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    issuedOn: dateKey,
    validUntil: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .pipe(dateKey.optional()),
    notes: z
      .string()
      .trim()
      .max(3_000)
      .transform((value) => value || undefined)
      .optional(),
    terms: z
      .string()
      .trim()
      .max(5_000)
      .transform((value) => value || undefined)
      .optional(),
    discountUsd: money.default("0"),
    items: z.array(quoteItemSchema).min(1).max(50),
  })
  .superRefine((value, context) => {
    if (value.currency === "ARS") {
      const valid =
        /^\d{1,12}(?:\.\d{1,6})?$/.test(value.exchangeRateArsPerUsd ?? "") &&
        !/^0(?:\.0+)?$/.test(value.exchangeRateArsPerUsd ?? "");
      if (!valid)
        context.addIssue({
          code: "custom",
          path: ["exchangeRateArsPerUsd"],
          message: "Ingresá una cotización ARS/USD mayor a cero.",
        });
    }
  });

export type QuoteInput = z.infer<typeof quoteInputSchema>;
