CREATE TABLE "pending_storage_deletions" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_storage_deletions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pending_storage_deletions_objectKey_key" ON "pending_storage_deletions"("objectKey");
CREATE INDEX "pending_storage_deletions_createdAt_idx" ON "pending_storage_deletions"("createdAt");
