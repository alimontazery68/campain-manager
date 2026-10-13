ALTER TABLE "Campaign" ADD COLUMN "learning" JSONB;
ALTER TABLE "CampaignDay" ADD COLUMN "guidance" JSONB;
ALTER TABLE "Task" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "preparationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
WITH ordered AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY "dayId" ORDER BY id)-1 AS position FROM "Task")
 UPDATE "Task" SET position = ordered.position FROM ordered WHERE "Task".id = ordered.id;
ALTER TABLE "DailyResult" ADD COLUMN "warmLeads" INTEGER, ADD COLUMN "notes" TEXT;
CREATE TABLE "CampaignChange" (
 "id" TEXT NOT NULL PRIMARY KEY, "campaignId" TEXT NOT NULL,
 "source" TEXT NOT NULL, "reason" TEXT NOT NULL, "data" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CampaignChange_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CampaignChange_campaignId_createdAt_idx" ON "CampaignChange"("campaignId","createdAt");
