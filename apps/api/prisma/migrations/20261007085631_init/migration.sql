-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CONTENT', 'OPERATIONAL', 'SALES', 'SUPPORT');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "campaignType" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "audience" TEXT,
    "problem" TEXT,
    "outcome" TEXT,
    "offer" JSONB,
    "salesPath" JSONB,
    "duration" INTEGER NOT NULL,
    "target" INTEGER,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDay" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "phase" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "CampaignDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "format" TEXT,
    "cta" TEXT,
    "why" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "content" TEXT,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDay_campaignId_dayNumber_key" ON "CampaignDay"("campaignId", "dayNumber");

-- AddForeignKey
ALTER TABLE "CampaignDay" ADD CONSTRAINT "CampaignDay_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "CampaignDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
