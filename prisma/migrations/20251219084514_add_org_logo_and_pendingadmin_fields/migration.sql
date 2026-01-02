-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "Logo" BYTEA;

-- AlterTable
ALTER TABLE "PendingAdmin" ADD COLUMN     "Address" TEXT,
ADD COLUMN     "Logo" BYTEA;
