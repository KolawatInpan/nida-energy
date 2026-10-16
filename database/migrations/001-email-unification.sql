-- ============================================================
-- MIGRATION: Email-Unification Refactor
-- Date: 2026-08-26
-- Description: Change User identity from email-based to credId-based
--              All users share the same email address
-- ============================================================

-- ============================================================
-- STEP 1: USER TABLE
-- ============================================================

-- 1.1 ลบ email FK จาก Building (ต้องทำก่อนเปลี่ยน User PK)
ALTER TABLE "Building" DROP CONSTRAINT IF EXISTS "Building_email_fkey";

-- 1.2 ลบ unique constraint จาก User.email (ยังเก็บ email ไว้ แต่ไม่ unique)
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";

-- 1.3 เปลี่ยน User PK จาก email เป็น credId
-- Prisma ใช้ @@id ดังนั้นต้อง drop PK เดิมแล้วสร้างใหม่
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("credId");

-- 1.4 เพิ่ม userId field (nullable สำหรับ backfill)
-- ถ้ายังไม่มี ให้เพิ่ม
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'userId'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "userId" INTEGER;
    ALTER TABLE "User" ADD CONSTRAINT "User_userId_key" UNIQUE ("userId");
  END IF;
END $$;

-- 1.5 เพิ่ม status field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'status'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- 1.6 เพิ่ม notification preference fields
-- (telegramChatId / notifyTelegram removed — email-only notifications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'notifyEmail'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "notifyEmail" BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE "User" ADD COLUMN "notifyTypes" TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- 1.7 ถอน Telegram fields (email-only notifications)
ALTER TABLE "User" DROP COLUMN IF EXISTS "telegramChatId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "notifyTelegram";

-- ============================================================
-- STEP 2: BUILDING TABLE
-- ============================================================

-- 2.1 เปลี่ยน Building.email → assignedContactEmail
ALTER TABLE "Building" DROP COLUMN IF EXISTS "email";
ALTER TABLE "Building" ADD COLUMN "assignedContactEmail" TEXT;

-- 2.2 เพิ่ม approvalStatus field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Building' AND column_name = 'approvalStatus'
  ) THEN
    ALTER TABLE "Building" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- ============================================================
-- STEP 3: WALLET TABLE
-- ============================================================

-- 3.1 ลบ email FK จาก Wallet
ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_email_fkey";
ALTER TABLE "Wallet" DROP CONSTRAINT IF EXISTS "Wallet_email_key";

-- 3.2 ลบ email column จาก Wallet
ALTER TABLE "Wallet" DROP COLUMN IF EXISTS "email";

-- 3.3 เพิ่ม buildingId column
ALTER TABLE "Wallet" ADD COLUMN "buildingId" INTEGER;

-- 3.4 สร้าง unique constraint บน buildingId (1:1)
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_buildingId_key" UNIQUE ("buildingId");

-- 3.5 สร้าง FK ไป Building
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_buildingId_fkey"
  FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- STEP 4: MARKET ORDER TABLE
-- ============================================================

-- 4.1 เปลี่ยน participantEmail → participantId
ALTER TABLE "MarketOrder" DROP COLUMN IF EXISTS "participantEmail";
ALTER TABLE "MarketOrder" ADD COLUMN "participantId" UUID;

-- 4.2 สร้าง FK ไป User.credId
ALTER TABLE "MarketOrder" ADD CONSTRAINT "MarketOrder_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "User"("credId") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- STEP 5: BUILDING ASSIGNMENT TABLE (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS "BuildingAssignment" (
  "id" SERIAL PRIMARY KEY,
  "buildingId" INTEGER NOT NULL,
  "userId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuildingAssignment_buildingId_fkey"
    FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BuildingAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("credId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BuildingAssignment_buildingId_userId_key"
    UNIQUE ("buildingId", "userId")
);

CREATE INDEX IF NOT EXISTS "BuildingAssignment_buildingId_idx" ON "BuildingAssignment"("buildingId");
CREATE INDEX IF NOT EXISTS "BuildingAssignment_userId_idx" ON "BuildingAssignment"("userId");

-- ============================================================
-- STEP 6: NOTIFICATION & ACTIVITY LOG
-- ============================================================

-- 6.1 Notification: เปลี่ยน email → userId
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "email";
ALTER TABLE "Notification" ADD COLUMN "userId" UUID;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("credId") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6.2 ActivityLog: เปลี่ยน email → userId
ALTER TABLE "ActivityLog" DROP COLUMN IF EXISTS "email";
ALTER TABLE "ActivityLog" ADD COLUMN "userId" UUID;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("credId") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- STEP 7: BACKFILL DATA
-- ============================================================

-- 7.1 Backfill BuildingAssignment จาก Building เดิม (ถ้ามีข้อมูล Building ที่มี owner)
-- ⚠️ รันหลังจากมี user ใหม่แล้ว (ไม่สามารถ backfill ได้เพราะไม่มี email FK อีก)

-- 7.2 Backfill Wallet.buildingId จาก Building เดิม
-- ⚠️ ต้องทำ manual mapping เพราะ Building ไม่มี email FK แล้ว
-- ตัวอย่าง:
-- UPDATE "Wallet" SET "buildingId" = (
--   SELECT "id" FROM "Building" WHERE "Building"."name" = '...'
-- ) WHERE "Wallet"."id" = '...';

-- ============================================================
-- DONE
-- ============================================================
-- หลังจากรัน migration นี้:
-- 1. User PK เปลี่ยนจาก email เป็น credId
-- 2. Building ไม่มี email FK อีก (ใช้ BuildingAssignment แทน)
-- 3. Wallet ผูกกับ Building (buildingId) แทน User (email)
-- 4. MarketOrder ใช้ participantId (UUID) แทน participantEmail
-- 5. Notification/ActivityLog ใช้ userId (UUID) แทน email
-- 6. BuildingAssignment table ใหม่สำหรับ M:N user ↔ building
