ALTER TABLE "client_share_links"
  ADD CONSTRAINT "client_share_links_token_hash_valid"
  CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "client_share_links_password_hash_nonblank"
  CHECK ("passwordHash" IS NULL OR btrim("passwordHash") <> '');

CREATE UNIQUE INDEX "client_share_links_one_active_per_client"
  ON "client_share_links"("clientId")
  WHERE "revokedAt" IS NULL;
