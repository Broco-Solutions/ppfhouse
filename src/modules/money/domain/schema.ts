import { z } from "zod";

const amount = z
  .string()
  .trim()
  .regex(
    /^\d{1,12}(?:\.\d{1,2})?$/,
    "Ingresá un importe válido con hasta 2 decimales.",
  );
const rate = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,6})?$/, "Ingresá una cotización válida.");

export const moneyInputSchema = z
  .object({
    currency: z.enum(["USD", "ARS"]),
    amount,
    exchangeRateArsPerUsd: z.string().optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.currency === "ARS") {
      if (
        !value.exchangeRateArsPerUsd ||
        !rate.safeParse(value.exchangeRateArsPerUsd).success
      ) {
        context.addIssue({
          code: "custom",
          path: ["exchangeRateArsPerUsd"],
          message: "Ingresá la cotización ARS/USD.",
        });
      } else if (/^0(?:\.0+)?$/.test(value.exchangeRateArsPerUsd)) {
        context.addIssue({
          code: "custom",
          path: ["exchangeRateArsPerUsd"],
          message: "La cotización debe ser mayor a cero.",
        });
      }
    }
  });
