ALTER TABLE "service_cases"
  ADD CONSTRAINT "service_cases_agreed_amount_check" CHECK ("agreedAmountUsd" IS NULL OR "agreedAmountUsd" >= 0);

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_range_check" CHECK ("endAt" > "startAt");

ALTER TABLE "appointment_services"
  ADD CONSTRAINT "appointment_services_duration_check" CHECK ("durationMinutesSnapshot" IS NULL OR "durationMinutesSnapshot" > 0),
  ADD CONSTRAINT "appointment_services_sort_order_check" CHECK ("sortOrder" >= 0);

ALTER TABLE "calendar_blocks"
  ADD CONSTRAINT "calendar_blocks_range_check" CHECK ("endAt" > "startAt");
