ALTER TABLE "Campaign" ADD COLUMN "creationKey" TEXT, ADD COLUMN "creationPayloadHash" TEXT;
CREATE UNIQUE INDEX "Campaign_creationKey_key" ON "Campaign"("creationKey");
ALTER TABLE "Task" ADD COLUMN "metadata" JSONB;
