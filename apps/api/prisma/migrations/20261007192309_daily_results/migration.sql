-- CreateTable
CREATE TABLE "DailyResult" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "views" INTEGER,
    "leads" INTEGER,
    "sales" INTEGER,
    "revenue" DECIMAL(15,0),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyResult_dayId_key" ON "DailyResult"("dayId");

-- AddForeignKey
ALTER TABLE "DailyResult" ADD CONSTRAINT "DailyResult_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "CampaignDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
