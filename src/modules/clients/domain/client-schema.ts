import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

export const clientInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Ingresá un nombre identificatorio.")
    .max(120),
  firstName: optionalText(80),
  lastName: optionalText(80),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z
    .union([
      z.string().trim().email("Ingresá un email válido.").max(160),
      z.literal(""),
    ])
    .transform((value) => value || undefined)
    .optional(),
  instagram: optionalText(80),
  notes: optionalText(2_000),
});

export const vehicleInputSchema = z.object({
  brand: z.string().trim().min(1, "Ingresá la marca.").max(80),
  model: z.string().trim().min(1, "Ingresá el modelo.").max(80),
  version: optionalText(100),
  year: z
    .union([z.coerce.number().int().min(1900).max(2100), z.literal("")])
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  color: optionalText(60),
  vehicleClass: z
    .union([z.enum(["SEDAN", "SUV", "PICKUP", "OTHER"]), z.literal("")])
    .transform((value) => value || undefined)
    .optional(),
  notes: optionalText(2_000),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export function normalizePhone(value?: string): string | null {
  if (!value) return null;
  const normalized = value.replace(/\D/g, "");
  return normalized || null;
}
