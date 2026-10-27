import { z } from "zod";

export const inventoryUnits = [
  "unit",
  "meter",
  "milliliter",
  "gram",
  "kilogram",
  "liter",
  "pair",
  "sheet",
] as const;

export const inventoryUnitLabels: Record<
  (typeof inventoryUnits)[number],
  string
> = {
  unit: "unidad",
  meter: "metro",
  milliliter: "mililitro",
  gram: "gramo",
  kilogram: "kilogramo",
  liter: "litro",
  pair: "par",
  sheet: "hoja",
};

export const inventoryUnitSymbols: Record<
  (typeof inventoryUnits)[number],
  string
> = {
  unit: "u",
  meter: "m",
  milliliter: "ml",
  gram: "g",
  kilogram: "kg",
  liter: "l",
  pair: "par",
  sheet: "hoja",
};

const quantity = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,3})?$/, "Usá hasta 3 decimales.")
  .refine((value) => Number(value) > 0, "La cantidad debe ser mayor a cero.");

const optionalMoney = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Usá hasta 2 decimales.")
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

export const inventoryCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const inventoryItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  sku: optionalText(60),
  baseUnit: z.enum(inventoryUnits),
  minimumStock: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,3})?$/, "Usá hasta 3 decimales."),
  costHintUsd: optionalMoney,
  notes: optionalText(1_000),
});

export const presentationSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  factorToBase: z
    .string()
    .trim()
    .regex(/^\d{1,12}(\.\d{1,6})?$/, "Usá hasta 6 decimales.")
    .refine((value) => Number(value) > 0, "El factor debe ser positivo."),
});

export const inventoryAdjustmentSchema = z.object({
  itemId: z.string().uuid(),
  direction: z.enum(["IN", "OUT"]),
  quantityBase: quantity,
  reason: z.string().trim().min(3).max(300),
  allowNegative: z.boolean().default(false),
  idempotencyKey: z.string().uuid(),
});

export type InventoryItemInput = z.input<typeof inventoryItemSchema>;
export type InventoryAdjustmentInput = z.input<
  typeof inventoryAdjustmentSchema
>;
