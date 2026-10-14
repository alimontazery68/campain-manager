-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Campaign_ownerId_updatedAt_idx" ON "Campaign"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
