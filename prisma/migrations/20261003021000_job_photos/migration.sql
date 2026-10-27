CREATE TYPE "PhotoStage" AS ENUM ('BEFORE', 'PROCESS', 'AFTER');

CREATE TABLE "photo_upload_intents" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "expectedMime" TEXT NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "uploadTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "uploadedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    CONSTRAINT "photo_upload_intents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "photo_upload_intents_size_valid" CHECK ("expectedSize" > 0 AND "expectedSize" <= 12582912),
    CONSTRAINT "photo_upload_intents_metadata_nonblank" CHECK (btrim("objectKey") <> '' AND btrim("expectedMime") <> '' AND btrim("uploadTokenHash") <> '')
);

CREATE TABLE "job_photos" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "uploadIntentId" UUID NOT NULL,
    "stage" "PhotoStage",
    "originalKey" TEXT NOT NULL,
    "previewKey" TEXT NOT NULL,
    "thumbnailKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,
    CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_photos_dimensions_valid" CHECK ("width" > 0 AND "height" > 0 AND "sizeBytes" > 0),
    CONSTRAINT "job_photos_sort_valid" CHECK ("sortOrder" >= 0),
    CONSTRAINT "job_photos_metadata_nonblank" CHECK (btrim("originalKey") <> '' AND btrim("previewKey") <> '' AND btrim("thumbnailKey") <> '' AND btrim("mimeType") <> '')
);

CREATE UNIQUE INDEX "photo_upload_intents_objectKey_key" ON "photo_upload_intents"("objectKey");
CREATE INDEX "photo_upload_intents_jobId_expiresAt_idx" ON "photo_upload_intents"("jobId", "expiresAt");
CREATE INDEX "photo_upload_intents_expiresAt_confirmedAt_idx" ON "photo_upload_intents"("expiresAt", "confirmedAt");
CREATE UNIQUE INDEX "job_photos_uploadIntentId_key" ON "job_photos"("uploadIntentId");
CREATE UNIQUE INDEX "job_photos_originalKey_key" ON "job_photos"("originalKey");
CREATE UNIQUE INDEX "job_photos_previewKey_key" ON "job_photos"("previewKey");
CREATE UNIQUE INDEX "job_photos_thumbnailKey_key" ON "job_photos"("thumbnailKey");
CREATE UNIQUE INDEX "job_photos_one_active_cover_per_job" ON "job_photos"("jobId") WHERE "isCover" = true AND "deletedAt" IS NULL;
CREATE INDEX "job_photos_jobId_deletedAt_sortOrder_idx" ON "job_photos"("jobId", "deletedAt", "sortOrder");
CREATE INDEX "job_photos_jobId_visibleToClient_deletedAt_idx" ON "job_photos"("jobId", "visibleToClient", "deletedAt");

ALTER TABLE "photo_upload_intents" ADD CONSTRAINT "photo_upload_intents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "photo_upload_intents" ADD CONSTRAINT "photo_upload_intents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_uploadIntentId_fkey" FOREIGN KEY ("uploadIntentId") REFERENCES "photo_upload_intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
