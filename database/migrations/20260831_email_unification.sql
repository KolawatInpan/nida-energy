-- =============================================================
-- Migration: Email-Unification
-- Step 1: Add new columns (nullable first)
-- Step 2: Backfill data from old columns
-- Step 3: Add NOT NULL + unique constraints
-- =============================================================

BEGIN;

-- =============================================
-- 1. BuildingAssignment: เพิ่ม userId column
-- =============================================
-- ตรวจสอบว่า column ใหม่ยังไม่มี
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'BuildingAssignment' AND column_name = 'userId'
    ) THEN
        ALTER TABLE "BuildingAssignment" ADD COLUMN "userId" TEXT;
    END IF;
END $$;

-- Backfill userId จาก Building → old owner email → User.credId
UPDATE "BuildingAssignment" ba
SET "userId" = u."credId"
FROM "User" u, "Building" b
WHERE ba."buildingId" = b.id
  AND ba."userId" IS NULL
  AND (
    -- match by old owner email (ถ้ามี owner relation)
    b."ownerId" = u."id"
    OR ba."userEmail" = u."email"
    -- fallback: ใช้ building name + user name
    OR (b.name || ' User') = u.name
  );

-- เพิ่ม NOT NULL constraint
ALTER TABLE "BuildingAssignment" ALTER COLUMN "userId" SET NOT NULL;

-- เพิ่ม unique constraint (buildingId, userId)
-- ตรวจสอบก่อนว่ามี duplicate ไหม
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'BuildingAssignment_buildingId_userId_key'
    ) THEN
        ALTER TABLE "BuildingAssignment" 
        ADD CONSTRAINT "BuildingAssignment_buildingId_userId_key" 
        UNIQUE ("buildingId", "userId");
    END IF;
END $$;

-- เพิ่ม index
CREATE INDEX IF NOT EXISTS "BuildingAssignment_userId_idx" ON "BuildingAssignment"("userId");
CREATE INDEX IF NOT EXISTS "BuildingAssignment_buildingId_idx" ON "BuildingAssignment"("buildingId");

-- =============================================
-- 2. Wallet: เพิ่ม buildingId column
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Wallet' AND column_name = 'buildingId'
    ) THEN
        ALTER TABLE "Wallet" ADD COLUMN "buildingId" INTEGER;
    END IF;
END $$;

-- Backfill buildingId จาก email → Building
UPDATE "Wallet" w
SET "buildingId" = b.id
FROM "Building" b
WHERE w."buildingId" IS NULL
  AND (
    w."email" = b."email"
    OR w."email" = b."assignedContactEmail"
    OR b.name || ' Building' = w."email"
    -- fallback: match by wallet id pattern
    OR w.id LIKE b.id || '%'
  );

-- เพิ่ม NOT NULL constraint
ALTER TABLE "Wallet" ALTER COLUMN "buildingId" SET NOT NULL;

-- เพิ่ม unique constraint (buildingId ต้อง unique เพราะ 1 building = 1 wallet)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Wallet_buildingId_key'
    ) THEN
        ALTER TABLE "Wallet" 
        ADD CONSTRAINT "Wallet_buildingId_key" 
        UNIQUE ("buildingId");
    END IF;
END $$;

-- =============================================
-- 3. ลบ old columns ที่ไม่ต้องใช้แล้ว
-- =============================================
-- ลบ BuildingAssignment.userEmail (ถ้ามี)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'BuildingAssignment' AND column_name = 'userEmail'
    ) THEN
        ALTER TABLE "BuildingAssignment" DROP COLUMN "userEmail";
    END IF;
END $$;

-- ลบ Wallet.email (ถ้ามี)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Wallet' AND column_name = 'email'
    ) THEN
        ALTER TABLE "Wallet" DROP COLUMN "email";
    END IF;
END $$;

-- ลบ Building.ownerId (ถ้ามี) — ย้ายไป BuildingAssignment
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Building' AND column_name = 'ownerId'
    ) THEN
        ALTER TABLE "Building" DROP COLUMN "ownerId";
    END IF;
END $$;

-- ลบ Building.email (ถ้ามี)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Building' AND column_name = 'email'
    ) THEN
        ALTER TABLE "Building" DROP COLUMN "email";
    END IF;
END $$;

-- =============================================
-- 4. Notification: เพิ่ม userId (ถ้า schema มี)
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Notification' AND column_name = 'userId'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "userId" TEXT;
        
        -- Backfill จาก email
        UPDATE "Notification" n
        SET "userId" = u."credId"
        FROM "User" u
        WHERE n."userId" IS NULL
          AND n."email" = u."email";
          
        ALTER TABLE "Notification" ALTER COLUMN "userId" SET NOT NULL;
    END IF;
END $$;

COMMIT;
