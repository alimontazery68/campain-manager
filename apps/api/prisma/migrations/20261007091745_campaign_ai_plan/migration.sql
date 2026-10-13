-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "aiPlan" JSONB,
ADD COLUMN     "maxContentPerDay" INTEGER NOT NULL DEFAULT 1;
