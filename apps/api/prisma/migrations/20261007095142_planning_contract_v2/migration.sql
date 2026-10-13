-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'PREPARATION';
ALTER TYPE "TaskType" ADD VALUE 'FOLLOW_UP';
ALTER TYPE "TaskType" ADD VALUE 'MEASUREMENT';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "planningContext" JSONB;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "objective" TEXT,
ADD COLUMN     "requiredAsset" TEXT;
