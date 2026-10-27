import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

const optionalPositiveInt = z
  .union([z.coerce.number().int().positive().max(100_000), z.literal("")])
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const moneyText = z
  .string()
  .trim()
  .regex(/^\d{1,17}([.,]\d{1,2})?$/, "Ingresá un importe USD válido.")
  .transform((value) => value.replace(",", "."));

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre de la categoría.").max(80),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const serviceInputSchema = z.object({
  categoryId: z.string().uuid("Elegí una categoría."),
  name: z.string().trim().min(2, "Ingresá el nombre del servicio.").max(120),
  internalDescription: optionalText(2_000),
  commercialDescription: optionalText(3_000),
  basePriceUsd: z
    .union([moneyText, z.literal("")])
    .default("")
    .transform((value) => value || undefined),
  estimatedDurationMinutes: optionalPositiveInt,
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const variantInputSchema = z
  .object({
    type: z.enum(["VEHICLE_CLASS", "MODEL_EXCEPTION"]),
    label: z.string().trim().min(2, "Ingresá una etiqueta clara.").max(100),
    vehicleClass: z
      .union([z.enum(["SEDAN", "SUV", "PICKUP", "OTHER"]), z.literal("")])
      .transform((value) => value || undefined)
      .optional(),
    matchBrand: optionalText(80),
    matchModel: optionalText(80),
    priceUsd: moneyText,
    estimatedDurationMinutes: optionalPositiveInt,
    priority: z.coerce.number().int().min(0).max(100).default(0),
  })
  .superRefine((value, context) => {
    if (value.type === "VEHICLE_CLASS" && !value.vehicleClass) {
      context.addIssue({
        code: "custom",
        path: ["vehicleClass"],
        message: "Elegí un segmento.",
      });
    }
    if (
      value.type === "MODEL_EXCEPTION" &&
      (!value.matchBrand || !value.matchModel)
    ) {
      context.addIssue({
        code: "custom",
        path: ["matchBrand"],
        message: "Indicá marca y modelo exactos.",
      });
    }
  });

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
