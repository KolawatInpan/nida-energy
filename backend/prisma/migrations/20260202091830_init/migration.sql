-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'BATTERY', 'PRODUCER', 'CONSUMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "TxDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EnergyOfferStatus" AS ENUM ('AVAILABLE', 'BOUGHT', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "credId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "address" TEXT,
    "telNum" TEXT,
    "lineID" TEXT,
    "position" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "UserCredential" (
    "credId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "identifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("credId","type")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mapURL" TEXT,
    "address" TEXT,
    "province" TEXT,
    "postal" TEXT,
    "status" TEXT,
    "energy" DECIMAL(65,30),
    "email" TEXT NOT NULL,
    "produceSN" TEXT,
    "consumeSN" TEXT,
    "batSN" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterInfo" (
    "snid" TEXT NOT NULL,
    "requestId" TEXT,
    "buildingName" TEXT NOT NULL,
    "meterName" TEXT NOT NULL,
    "value" DECIMAL(65,30),
    "capacity" DECIMAL(65,30),
    "timestamp" TIMESTAMP(3),
    "produceMeter" BOOLEAN,
    "consumeMeter" BOOLEAN,
    "batMeter" BOOLEAN,
    "dateInstalled" TIMESTAMP(3),
    "dateSubmit" TIMESTAMP(3),
    "approveStatus" TEXT,
    "kwh" DECIMAL(65,30),

    CONSTRAINT "MeterInfo_pkey" PRIMARY KEY ("snid")
);

-- CreateTable
CREATE TABLE "HourlyEnergy" (
    "meterName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "h0" DECIMAL(65,30),
    "h1" DECIMAL(65,30),
    "h2" DECIMAL(65,30),
    "h3" DECIMAL(65,30),
    "h4" DECIMAL(65,30),
    "h5" DECIMAL(65,30),
    "h6" DECIMAL(65,30),
    "h7" DECIMAL(65,30),
    "h8" DECIMAL(65,30),
    "h9" DECIMAL(65,30),
    "h10" DECIMAL(65,30),
    "h11" DECIMAL(65,30),
    "h12" DECIMAL(65,30),
    "h13" DECIMAL(65,30),
    "h14" DECIMAL(65,30),
    "h15" DECIMAL(65,30),
    "h16" DECIMAL(65,30),
    "h17" DECIMAL(65,30),
    "h18" DECIMAL(65,30),
    "h19" DECIMAL(65,30),
    "h20" DECIMAL(65,30),
    "h21" DECIMAL(65,30),
    "h22" DECIMAL(65,30),
    "h23" DECIMAL(65,30),
    "kwh" DECIMAL(65,30),

    CONSTRAINT "HourlyEnergy_pkey" PRIMARY KEY ("meterName","date")
);

-- CreateTable
CREATE TABLE "DailyEnergy" (
    "meterName" TEXT NOT NULL,
    "monthId" INTEGER NOT NULL,
    "d1" DECIMAL(65,30),
    "d2" DECIMAL(65,30),
    "d3" DECIMAL(65,30),
    "d4" DECIMAL(65,30),
    "d5" DECIMAL(65,30),
    "d6" DECIMAL(65,30),
    "d7" DECIMAL(65,30),
    "d8" DECIMAL(65,30),
    "d9" DECIMAL(65,30),
    "d10" DECIMAL(65,30),
    "d11" DECIMAL(65,30),
    "d12" DECIMAL(65,30),
    "d13" DECIMAL(65,30),
    "d14" DECIMAL(65,30),
    "d15" DECIMAL(65,30),
    "d16" DECIMAL(65,30),
    "d17" DECIMAL(65,30),
    "d18" DECIMAL(65,30),
    "d19" DECIMAL(65,30),
    "d20" DECIMAL(65,30),
    "d21" DECIMAL(65,30),
    "d22" DECIMAL(65,30),
    "d23" DECIMAL(65,30),
    "d24" DECIMAL(65,30),
    "d25" DECIMAL(65,30),
    "d26" DECIMAL(65,30),
    "d27" DECIMAL(65,30),
    "d28" DECIMAL(65,30),
    "d29" DECIMAL(65,30),
    "d30" DECIMAL(65,30),
    "d31" DECIMAL(65,30),
    "kwh" DECIMAL(65,30),

    CONSTRAINT "DailyEnergy_pkey" PRIMARY KEY ("meterName","monthId")
);

-- CreateTable
CREATE TABLE "WeeklyEnergy" (
    "meterName" TEXT NOT NULL,
    "weekId" INTEGER NOT NULL,
    "Sun" DECIMAL(65,30),
    "Mon" DECIMAL(65,30),
    "Tue" DECIMAL(65,30),
    "Wed" DECIMAL(65,30),
    "Thu" DECIMAL(65,30),
    "Fri" DECIMAL(65,30),
    "Sat" DECIMAL(65,30),
    "kwh" DECIMAL(65,30),

    CONSTRAINT "WeeklyEnergy_pkey" PRIMARY KEY ("meterName","weekId")
);

-- CreateTable
CREATE TABLE "MonthlyEnergy" (
    "meterName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "M1" DECIMAL(65,30),
    "M2" DECIMAL(65,30),
    "M3" DECIMAL(65,30),
    "M4" DECIMAL(65,30),
    "M5" DECIMAL(65,30),
    "M6" DECIMAL(65,30),
    "M7" DECIMAL(65,30),
    "M8" DECIMAL(65,30),
    "M9" DECIMAL(65,30),
    "M10" DECIMAL(65,30),
    "M11" DECIMAL(65,30),
    "M12" DECIMAL(65,30),
    "kwh" DECIMAL(65,30),

    CONSTRAINT "MonthlyEnergy_pkey" PRIMARY KEY ("meterName","year")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedKey" TEXT,
    "isCustodial" BOOLEAN NOT NULL DEFAULT false,
    "chain" TEXT NOT NULL DEFAULT 'ganache',
    "tokenBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "quota" DECIMAL(65,30),

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTx" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenInOut" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "WalletTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "fromWId" TEXT NOT NULL,
    "toWId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "kwh" DECIMAL(65,30),
    "tokenAmount" DECIMAL(65,30),
    "paid" BOOLEAN,
    "late" BOOLEAN,
    "fine" BOOLEAN,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "dailyAvg" DECIMAL(65,30),
    "peakDate" TIMESTAMP(3),
    "peakkWh" DECIMAL(65,30),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "walletTxId" TEXT NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyOffer" (
    "id" SERIAL NOT NULL,
    "sellerWalletId" TEXT NOT NULL,
    "buyerWalletId" TEXT,
    "kwh" DECIMAL(65,30) NOT NULL,
    "ratePerKwh" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "status" "EnergyOfferStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnergyOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "activitytype" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battery" (
    "id" TEXT NOT NULL,
    "sn" TEXT NOT NULL,
    "capacityKwh" DECIMAL(65,30) NOT NULL,
    "currentKwh" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currentPercentage" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "buildingId" INTEGER NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockTransaction" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "height" DECIMAL(65,30),
    "txAmount" DECIMAL(65,30),
    "blockHash" TEXT,
    "parentHash" TEXT,
    "validator" TEXT,
    "gasUsed" DECIMAL(65,30),
    "txFee" DECIMAL(65,30),
    "blockSize" DECIMAL(65,30),
    "timestamp" TIMESTAMP(3),

    CONSTRAINT "BlockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_credId_key" ON "User"("credId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Building_name_key" ON "Building"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MeterInfo_meterName_key" ON "MeterInfo"("meterName");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_invoiceId_key" ON "Receipt"("invoiceId");

-- CreateIndex
CREATE INDEX "EnergyOffer_sellerWalletId_idx" ON "EnergyOffer"("sellerWalletId");

-- CreateIndex
CREATE INDEX "EnergyOffer_status_idx" ON "EnergyOffer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Battery_sn_key" ON "Battery"("sn");

-- AddForeignKey
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_credId_fkey" FOREIGN KEY ("credId") REFERENCES "User"("credId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterInfo" ADD CONSTRAINT "MeterInfo_buildingName_fkey" FOREIGN KEY ("buildingName") REFERENCES "Building"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyEnergy" ADD CONSTRAINT "HourlyEnergy_meterName_fkey" FOREIGN KEY ("meterName") REFERENCES "MeterInfo"("meterName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEnergy" ADD CONSTRAINT "DailyEnergy_meterName_fkey" FOREIGN KEY ("meterName") REFERENCES "MeterInfo"("meterName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyEnergy" ADD CONSTRAINT "WeeklyEnergy_meterName_fkey" FOREIGN KEY ("meterName") REFERENCES "MeterInfo"("meterName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEnergy" ADD CONSTRAINT "MonthlyEnergy_meterName_fkey" FOREIGN KEY ("meterName") REFERENCES "MeterInfo"("meterName") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_email_fkey" FOREIGN KEY ("email") REFERENCES "User"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTx" ADD CONSTRAINT "WalletTx_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
