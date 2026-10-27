ALTER TABLE "inventory_categories"
  ADD CONSTRAINT "inventory_categories_name_nonblank" CHECK (btrim("name") <> '');

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_name_nonblank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "inventory_items_base_unit_supported" CHECK (
    "baseUnit" IN ('unit', 'meter', 'milliliter', 'gram', 'kilogram', 'liter', 'pair', 'sheet')
  ),
  ADD CONSTRAINT "inventory_items_minimum_stock_nonnegative" CHECK ("minimumStock" >= 0),
  ADD CONSTRAINT "inventory_items_cost_hint_nonnegative" CHECK ("costHintUsd" IS NULL OR "costHintUsd" >= 0);

ALTER TABLE "purchase_presentations"
  ADD CONSTRAINT "purchase_presentations_name_nonblank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "purchase_presentations_factor_positive" CHECK ("factorToBase" > 0);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_nonzero" CHECK ("signedQuantityBase" <> 0),
  ADD CONSTRAINT "inventory_movements_unit_nonblank" CHECK (btrim("unitSnapshot") <> ''),
  ADD CONSTRAINT "inventory_movements_note_nonblank" CHECK (btrim("note") <> ''),
  ADD CONSTRAINT "inventory_movements_direction_matches_type" CHECK (
    ("type" IN ('PURCHASE', 'ADJUSTMENT_IN', 'RETURN') AND "signedQuantityBase" > 0)
    OR ("type" IN ('CONSUMPTION', 'ADJUSTMENT_OUT') AND "signedQuantityBase" < 0)
    OR "type" = 'REVERSAL'
  ),
  ADD CONSTRAINT "inventory_movements_reversal_link" CHECK (
    ("type" = 'REVERSAL') = ("reversalOfId" IS NOT NULL)
  );
