export interface PricingVariant {
  id: string;
  type: "VEHICLE_CLASS" | "MODEL_EXCEPTION";
  vehicleClass?: "SEDAN" | "SUV" | "PICKUP" | "OTHER" | null;
  matchBrand?: string | null;
  matchModel?: string | null;
  priceUsd: string;
  estimatedDurationMinutes?: number | null;
  priority: number;
  active: boolean;
}

export interface PricingVehicle {
  brand: string;
  model: string;
  vehicleClass?: "SEDAN" | "SUV" | "PICKUP" | "OTHER" | null;
}

const normalized = (value: string) => value.trim().toLocaleLowerCase("es-AR");

export function resolveSuggestedPrice(input: {
  basePriceUsd?: string | null;
  estimatedDurationMinutes?: number | null;
  variants: readonly PricingVariant[];
  vehicle: PricingVehicle;
}) {
  const variants = input.variants
    .filter((variant) => variant.active)
    .slice()
    .sort((a, b) => b.priority - a.priority);
  const modelException = variants.find(
    (variant) =>
      variant.type === "MODEL_EXCEPTION" &&
      normalized(variant.matchBrand ?? "") ===
        normalized(input.vehicle.brand) &&
      normalized(variant.matchModel ?? "") === normalized(input.vehicle.model),
  );
  const classVariant = variants.find(
    (variant) =>
      variant.type === "VEHICLE_CLASS" &&
      Boolean(input.vehicle.vehicleClass) &&
      variant.vehicleClass === input.vehicle.vehicleClass,
  );
  const selected = modelException ?? classVariant;
  return {
    priceUsd: selected?.priceUsd ?? input.basePriceUsd ?? null,
    estimatedDurationMinutes:
      selected?.estimatedDurationMinutes ??
      input.estimatedDurationMinutes ??
      null,
    source: selected
      ? selected.type
      : input.basePriceUsd
        ? ("BASE" as const)
        : ("TO_QUOTE" as const),
    variantId: selected?.id ?? null,
  };
}
