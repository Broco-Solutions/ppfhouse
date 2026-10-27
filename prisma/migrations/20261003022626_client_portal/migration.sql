-- CreateTable
CREATE TABLE "client_share_links" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "lastAccessAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "client_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_share_links_tokenHash_key" ON "client_share_links"("tokenHash");

-- CreateIndex
CREATE INDEX "client_share_links_clientId_createdAt_idx" ON "client_share_links"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "client_share_links_expiresAt_revokedAt_idx" ON "client_share_links"("expiresAt", "revokedAt");

-- AddForeignKey
ALTER TABLE "client_share_links" ADD CONSTRAINT "client_share_links_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_share_links" ADD CONSTRAINT "client_share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_share_links" ADD CONSTRAINT "client_share_links_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
