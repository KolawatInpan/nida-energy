const { Client } = require('pg');

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

async function withClient(callback) {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function ensureCredIdColumn() {
  await withClient(async (client) => {
    await client.query(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "credId" UUID
    `);
  });
}

async function ensureUserRoleDefault() {
  await withClient(async (client) => {
    // Ensure 'USER' and 'ADMIN' enum values exist; adding without position is safe
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TYPE "UserRole" ADD VALUE 'USER';
        EXCEPTION WHEN duplicate_object THEN
          NULL;
        END;
        BEGIN
          ALTER TYPE "UserRole" ADD VALUE 'ADMIN';
        EXCEPTION WHEN duplicate_object THEN
          NULL;
        END;
      END $$;
    `);

    await client.query(`
      ALTER TABLE "User"
      ALTER COLUMN "role" SET DEFAULT 'USER'
    `);
  });
}

async function ensureTransactionVerificationColumns() {
  await withClient(async (client) => {
    await client.query(`
      ALTER TABLE "Transaction"
      ADD COLUMN IF NOT EXISTS "verificationStatus" VARCHAR,
      ADD COLUMN IF NOT EXISTS "verificationMethod" VARCHAR,
      ADD COLUMN IF NOT EXISTS "chainId" INTEGER,
      ADD COLUMN IF NOT EXISTS "verificationPayload" TEXT,
      ADD COLUMN IF NOT EXISTS "payloadHash" VARCHAR,
      ADD COLUMN IF NOT EXISTS "txHash" VARCHAR,
      ADD COLUMN IF NOT EXISTS "explorerUrl" VARCHAR,
      ADD COLUMN IF NOT EXISTS "publisherAddress" VARCHAR,
      ADD COLUMN IF NOT EXISTS "contractAddress" VARCHAR,
      ADD COLUMN IF NOT EXISTS "blockNumber" INTEGER,
      ADD COLUMN IF NOT EXISTS "gasUsed" VARCHAR,
      ADD COLUMN IF NOT EXISTS "effectiveGasPrice" VARCHAR,
      ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_transaction_verificationStatus"
      ON "Transaction" ("verificationStatus")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_transaction_txHash"
      ON "Transaction" ("txHash")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_transaction_contractAddress"
      ON "Transaction" ("contractAddress")
    `);
  });
}

async function ensureBlockTransactionColumns() {
  await withClient(async (client) => {
    await client.query(`
      ALTER TABLE "BlockTransaction"
      ADD COLUMN IF NOT EXISTS "txHash" VARCHAR,
      ADD COLUMN IF NOT EXISTS "appTxId" VARCHAR,
      ADD COLUMN IF NOT EXISTS "payloadHash" VARCHAR,
      ADD COLUMN IF NOT EXISTS "status" VARCHAR,
      ADD COLUMN IF NOT EXISTS "chainId" INTEGER,
      ADD COLUMN IF NOT EXISTS "explorerUrl" VARCHAR,
      ADD COLUMN IF NOT EXISTS "verificationMethod" VARCHAR,
      ADD COLUMN IF NOT EXISTS "contractAddress" VARCHAR,
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT NOW()
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_block_transaction_txHash_unique"
      ON "BlockTransaction" ("txHash")
      WHERE "txHash" IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_block_transaction_appTxId"
      ON "BlockTransaction" ("appTxId")
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_block_transaction_status"
      ON "BlockTransaction" ("status")
    `);
  });
}

async function ensureWalletFloatColumns() {
  await withClient(async (client) => {
    await client.query(`
      ALTER TABLE "Wallet"
      ALTER COLUMN "tokenBalance" TYPE DOUBLE PRECISION USING COALESCE("tokenBalance", 0)::double precision,
      ALTER COLUMN "quota" TYPE DOUBLE PRECISION USING CASE WHEN "quota" IS NULL THEN NULL ELSE "quota"::double precision END
    `);
    await client.query(`
      ALTER TABLE "Wallet"
      ALTER COLUMN "tokenBalance" SET DEFAULT 0
    `);
  });
}

async function ensureEnergyDecimalColumns() {
  await withClient(async (client) => {
    const decimalColumns = {
      Building: ['energy'],
      MeterInfo: ['value', 'capacity', 'kWH'],
      RunningMeter: ['kW', 'kWH'],
      HourlyEnergy: ['h0','h1','h2','h3','h4','h5','h6','h7','h8','h9','h10','h11','h12','h13','h14','h15','h16','h17','h18','h19','h20','h21','h22','h23','kWH'],
      DailyEnergy: ['d1','d2','d3','d4','d5','d6','d7','d8','d9','d10','d11','d12','d13','d14','d15','d16','d17','d18','d19','d20','d21','d22','d23','d24','d25','d26','d27','d28','d29','d30','d31','kWH'],
      WeeklyEnergy: ['sun','mon','tue','wed','thu','fri','sat','kWH'],
      MonthlyEnergy: ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','kWH'],
    };

    for (const [tableName, columns] of Object.entries(decimalColumns)) {
      for (const columnName of columns) {
        // determine actual column name in DB (some schemas use lowercase 'kwh' etc.)
        let actualColumn = null;
        // try exact name
        let q = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [tableName, columnName]);
        if (q.rowCount > 0) actualColumn = q.rows[0].column_name;
        // try lowercase
        if (!actualColumn) {
          const lower = columnName.toLowerCase();
          q = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [tableName, lower]);
          if (q.rowCount > 0) actualColumn = q.rows[0].column_name;
        }
        // try uppercase
        if (!actualColumn) {
          const upper = columnName.toUpperCase();
          q = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`, [tableName, upper]);
          if (q.rowCount > 0) actualColumn = q.rows[0].column_name;
        }

        if (!actualColumn) {
          // column doesn't exist in DB; skip
          continue;
        }

        await client.query(`
          ALTER TABLE "${tableName}"
          ALTER COLUMN "${actualColumn}" TYPE NUMERIC(12,4)
          USING CASE
            WHEN "${actualColumn}" IS NULL THEN NULL
            ELSE ROUND("${actualColumn}"::numeric, 4)
          END
        `);
      }
    }
  });
}

async function ensureBuildingTradeColumns() {
  await withClient(async (client) => {
    await client.query(`
      ALTER TABLE "Building"
      ADD COLUMN IF NOT EXISTS "batterySellThreshold" NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS "solarSelfPercent" NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS "solarTradeMode" VARCHAR,
      ADD COLUMN IF NOT EXISTS "batteryTradeMode" VARCHAR,
      ADD COLUMN IF NOT EXISTS "batteryBidPrice" NUMERIC(12,4),
      ADD COLUMN IF NOT EXISTS "batteryOfferPrice" NUMERIC(12,4),
      ADD COLUMN IF NOT EXISTS "solarOfferPrice" NUMERIC(12,4)
    `);
  });
}

module.exports = {
  ensureBlockTransactionColumns,
  ensureCredIdColumn,
  ensureUserRoleDefault,
  ensureTransactionVerificationColumns,
  ensureWalletFloatColumns,
  ensureEnergyDecimalColumns,
   ensureBuildingTradeColumns,
};

