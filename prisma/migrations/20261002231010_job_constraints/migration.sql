ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_void_fields_consistent"
  CHECK (("voidedAt" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND length(trim("voidReason")) >= 4));

ALTER TABLE "job_services"
  ADD CONSTRAINT "job_services_name_not_blank" CHECK (length(trim("nameSnapshot")) > 0),
  ADD CONSTRAINT "job_services_sort_nonnegative" CHECK ("sortOrder" >= 0);
