ALTER TABLE "Campaign" ADD COLUMN "preparationInitialized" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "PreparationTask" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "why" TEXT NOT NULL,
  "requiredBeforeDay" INTEGER,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PreparationTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PreparationTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PreparationTask_campaignId_position_key" ON "PreparationTask"("campaignId", "position");
