-- Enums
CREATE TYPE "UserRole" AS ENUM ('USER','BATTERY','PRODUCER','CONSUMER','ADMIN');
CREATE TYPE "TxStatus" AS ENUM ('PENDING','CONFIRMED','FAILED');
CREATE TYPE "ErrorSeverity" AS ENUM ('INFO','WARNING','ERROR','CRITICAL');
CREATE TYPE "EnergyOfferStatus" AS ENUM ('AVAILABLE','BOUGHT','CANCELLED');

-- Users
CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE,
  role "UserRole" DEFAULT 'USER',
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

-- Buildings (create before Wallet because Wallet references Building)
CREATE TABLE "Building" (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  address VARCHAR,
  ownerId INT REFERENCES "User"(id),
  createdAt TIMESTAMP DEFAULT now()
);

-- Wallets
CREATE TABLE "Wallet" (
  id SERIAL PRIMARY KEY,
  userId INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  address VARCHAR NOT NULL UNIQUE,
  label VARCHAR,
  encryptedKey VARCHAR,
  isCustodial BOOLEAN DEFAULT false,
  chain VARCHAR DEFAULT 'ganache',
  tokenBalance NUMERIC DEFAULT 0,
  ethBalance NUMERIC DEFAULT 0,
  buildingId INT REFERENCES "Building"(id),
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_wallet_userid ON "Wallet"(userId);

-- UserCredential
CREATE TABLE "UserCredential" (
  id SERIAL PRIMARY KEY,
  userId INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  identifier VARCHAR,
  secretHash VARCHAR NOT NULL,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now(),
  UNIQUE(type, identifier)
);

CREATE INDEX idx_usercredential_userid_type ON "UserCredential"(userId, type);

-- Transaction
CREATE TABLE "Transaction" (
  id SERIAL PRIMARY KEY,
  fromWalletId INT REFERENCES "Wallet"(id),
  toWalletId INT REFERENCES "Wallet"(id),
  fromAddress VARCHAR,
  toAddress VARCHAR,
  amount NUMERIC NOT NULL,
  tokenSymbol VARCHAR NOT NULL,
  energyKwh NUMERIC,
  txHash VARCHAR,
  status "TxStatus" DEFAULT 'PENDING',
  gasUsed NUMERIC,
  gasPrice NUMERIC,
  fee NUMERIC,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_transaction_fromAddress ON "Transaction"(fromAddress);
CREATE INDEX idx_transaction_toAddress ON "Transaction"(toAddress);
CREATE INDEX idx_transaction_txHash ON "Transaction"(txHash);

-- Energy
CREATE TABLE "Energy" (
  id SERIAL PRIMARY KEY,
  userId INT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  kwh NUMERIC NOT NULL,
  source VARCHAR,
  note VARCHAR,
  recordedAt TIMESTAMP DEFAULT now(),
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_energy_userId_recordedAt ON "Energy"(userId, recordedAt);

-- ActivityLog
CREATE TABLE "ActivityLog" (
  id SERIAL PRIMARY KEY,
  userId INT REFERENCES "User"(id) ON DELETE CASCADE,
  type VARCHAR NOT NULL,
  detail JSON,
  ip VARCHAR,
  ua VARCHAR,
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_activitylog_userId_createdAt ON "ActivityLog"(userId, createdAt);

-- Notification
CREATE TABLE "Notification" (
  id SERIAL PRIMARY KEY,
  userId INT REFERENCES "User"(id) ON DELETE CASCADE,
  title VARCHAR NOT NULL,
  body VARCHAR NOT NULL,
  data JSON,
  read BOOLEAN DEFAULT false,
  channel VARCHAR,
  createdAt TIMESTAMP DEFAULT now(),
  readAt TIMESTAMP
);

-- ErrorLog
CREATE TABLE "ErrorLog" (
  id SERIAL PRIMARY KEY,
  source VARCHAR NOT NULL,
  service VARCHAR,
  message VARCHAR NOT NULL,
  stack TEXT,
  severity "ErrorSeverity" DEFAULT 'ERROR',
  extra JSON,
  createdAt TIMESTAMP DEFAULT now(),
  handled BOOLEAN DEFAULT false,
  handledAt TIMESTAMP
);

-- RateToken
CREATE TABLE "RateToken" (
  id SERIAL PRIMARY KEY,
  token VARCHAR NOT NULL,
  base VARCHAR NOT NULL,
  rate NUMERIC NOT NULL,
  effectiveAt TIMESTAMP DEFAULT now(),
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_ratetoken_token_base_effectiveAt ON "RateToken"(token, base, effectiveAt);

-- RateEnergy
CREATE TABLE "RateEnergy" (
  id SERIAL PRIMARY KEY,
  region VARCHAR,
  pricePerKwh NUMERIC NOT NULL,
  currency VARCHAR DEFAULT 'THB',
  effectiveAt TIMESTAMP DEFAULT now(),
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_rateenergy_region_effectiveAt ON "RateEnergy"(region, effectiveAt);

-- BuildingDashboard
CREATE TABLE "BuildingDashboard" (
  id SERIAL PRIMARY KEY,
  buildingId INT NOT NULL REFERENCES "Building"(id) ON DELETE CASCADE,
  periodStart TIMESTAMP NOT NULL,
  periodEnd TIMESTAMP NOT NULL,
  metricType VARCHAR NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_buildingdashboard_buildingId_periodStart ON "BuildingDashboard"(buildingId, periodStart);

-- DashboardAggregate
CREATE TABLE "DashboardAggregate" (
  id SERIAL PRIMARY KEY,
  periodStart TIMESTAMP NOT NULL,
  periodEnd TIMESTAMP NOT NULL,
  metric VARCHAR NOT NULL,
  value NUMERIC NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_dashboardaggregate_periodStart_metric ON "DashboardAggregate"(periodStart, metric);

-- EnergyOffer (after Wallet)
CREATE TABLE "EnergyOffer" (
  id SERIAL PRIMARY KEY,
  sellerWalletId INT NOT NULL REFERENCES "Wallet"(id),
  kwh NUMERIC NOT NULL,
  ratePerKwh NUMERIC NOT NULL,
  totalPrice NUMERIC NOT NULL,
  status "EnergyOfferStatus" DEFAULT 'AVAILABLE',
  buyerWalletId INT REFERENCES "Wallet"(id),
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_energyoffer_sellerWalletId ON "EnergyOffer"(sellerWalletId);
CREATE INDEX idx_energyoffer_status ON "EnergyOffer"(status);
