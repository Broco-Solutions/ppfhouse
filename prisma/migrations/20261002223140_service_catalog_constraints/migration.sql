-- Domain constraints not expressible in Prisma schema.
ALTER TABLE "services"
  ADD CONSTRAINT "services_base_price_check" CHECK ("basePriceUsd" IS NULL OR "basePriceUsd" >= 0),
  ADD CONSTRAINT "services_duration_check" CHECK ("estimatedDurationMinutes" IS NULL OR "estimatedDurationMinutes" > 0),
  ADD CONSTRAINT "services_sort_order_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "service_variants"
  ADD CONSTRAINT "service_variants_price_check" CHECK ("priceUsd" >= 0),
  ADD CONSTRAINT "service_variants_duration_check" CHECK ("estimatedDurationMinutes" IS NULL OR "estimatedDurationMinutes" > 0),
  ADD CONSTRAINT "service_variants_priority_check" CHECK ("priority" BETWEEN 0 AND 100),
  ADD CONSTRAINT "service_variants_shape_check" CHECK (
    ("type" = 'VEHICLE_CLASS' AND "vehicleClass" IS NOT NULL AND "matchBrand" IS NULL AND "matchModel" IS NULL)
    OR
    ("type" = 'MODEL_EXCEPTION' AND "vehicleClass" IS NULL AND "matchBrand" IS NOT NULL AND "matchModel" IS NOT NULL)
  );

CREATE UNIQUE INDEX "service_variants_class_unique"
  ON "service_variants"("serviceId", "vehicleClass")
  WHERE "type" = 'VEHICLE_CLASS';

CREATE UNIQUE INDEX "service_variants_model_unique"
  ON "service_variants"("serviceId", lower("matchBrand"), lower("matchModel"))
  WHERE "type" = 'MODEL_EXCEPTION';
