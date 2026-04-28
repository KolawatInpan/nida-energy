const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

async function enrichTransactions(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const walletIds = [...new Set(rows.map((row) => String(row?.walletId || '')).filter(Boolean))];
    const buildingNames = [...new Set(rows.map((row) => String(row?.buildingName || '')).filter(Boolean))];

    const [wallets, buildingsById, buildingsByName] = await Promise.all([
        walletIds.length
            ? prisma.wallet.findMany({
                where: { id: { in: walletIds } },
                select: { id: true, email: true },
            })
            : Promise.resolve([]),
        walletIds.length
            ? prisma.building.findMany({
                where: { id: { in: walletIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)) } },
                select: { id: true, name: true, produceSN: true, consumeSN: true, batSN: true, email: true },
            })
            : Promise.resolve([]),
        buildingNames.length
            ? prisma.building.findMany({
                where: { name: { in: buildingNames } },
                select: { id: true, name: true, produceSN: true, consumeSN: true, batSN: true, email: true },
            })
            : Promise.resolve([]),
    ]);

    const walletById = new Map(wallets.map((wallet) => [String(wallet.id), wallet]));
    const buildingByWalletId = new Map(buildingsById.map((building) => [String(building.id), building]));
    const buildingByName = new Map(buildingsByName.map((building) => [String(building.name), building]));

    if (wallets.length) {
        const missingEmails = [...new Set(wallets.map((wallet) => String(wallet.email || '')).filter(Boolean))]
            .filter((email) => !Array.from(buildingByWalletId.values()).some((building) => String(building.email || '') === email));

        if (missingEmails.length) {
            const buildingsByEmail = await prisma.building.findMany({
                where: { email: { in: missingEmails } },
                select: { id: true, name: true, produceSN: true, consumeSN: true, batSN: true, email: true },
            });

            buildingsByEmail.forEach((building) => {
                const email = String(building.email || '');
                wallets
                    .filter((wallet) => String(wallet.email || '') === email)
                    .forEach((wallet) => buildingByWalletId.set(String(wallet.id), building));
                buildingByName.set(String(building.name), building);
            });
        }
    }

    return rows.map((row) => {
        const walletId = String(row?.walletId || '');
        const existingBuildingName = row?.buildingName ? String(row.buildingName) : '';
        const building = (existingBuildingName && buildingByName.get(existingBuildingName))
            || (walletId && buildingByWalletId.get(walletId))
            || null;

        const fallbackSnid = building
            ? (building.consumeSN || building.produceSN || building.batSN || null)
            : null;

        return {
            ...row,
            buildingName: existingBuildingName || building?.name || null,
            snid: row?.snid || fallbackSnid || null,
        };
    });
}

async function getTransactions() {
    const rows = await prisma.transaction.findMany({
        orderBy: { timestamp: 'desc' }
    });
    return enrichTransactions(rows);
}

async function getTransactionById(id) {
    const row = await prisma.transaction.findUnique({ where: { txid: String(id) } });
    if (!row) return null;
    const [enriched] = await enrichTransactions([row]);
    return enriched || row;
}

async function getTransactionsByBuilding(buildingName) {
    const rows = await prisma.transaction.findMany({
        where: { buildingName: String(buildingName) },
        orderBy: { timestamp: 'desc' }
    });
    return enrichTransactions(rows);
}

async function getTransactionsByWallet(walletId) {
    const rows = await prisma.transaction.findMany({
        where: { walletId: String(walletId) },
        orderBy: { timestamp: 'desc' }
    });
    return enrichTransactions(rows);
}

async function getRecentBlockchainTransactions(limit = 50) {
    const take = Math.max(1, Math.min(Number(limit) || 50, 200));
    const rows = await prisma.$queryRawUnsafe(`
        SELECT
            t."id" AS "txid",
            t."timestamp",
            t."buildingName",
            t."snid",
            t."walletId",
            t."type",
            t."amount" AS "tokenAmount",
            t."status",
            t."verificationStatus",
            t."verificationMethod",
            t."chainId",
            t."verificationPayload",
            t."payloadHash",
            t."txHash",
            t."explorerUrl",
            t."publisherAddress",
            t."contractAddress",
            t."blockNumber",
            t."gasUsed",
            t."effectiveGasPrice",
            t."verifiedAt",
            bt."id" AS "blockTransactionId",
            bt."blockHash" AS "chainBlockHash",
            bt."parentHash" AS "chainParentHash",
            bt."txFee" AS "chainTxFee",
            bt."blockSize" AS "chainBlockSize",
            bt."timestamp" AS "chainTimestamp"
        FROM "Transaction" t
        LEFT JOIN "BlockTransaction" bt
          ON bt."txHash" = t."txHash"
        WHERE t."txHash" IS NOT NULL
        ORDER BY COALESCE(t."verifiedAt", t."timestamp") DESC, t."timestamp" DESC
        LIMIT ${take}
    `);
    return enrichTransactions(rows);
}

async function getBlockchainTransactionByHash(txHash) {
    if (!txHash) return null;

    const rows = await prisma.$queryRawUnsafe(`
        SELECT
            t.*,
            t."id" AS "txid",
            t."amount" AS "tokenAmount",
            bt."id" AS "blockTransactionId",
            bt."blockHash" AS "chainBlockHash",
            bt."parentHash" AS "chainParentHash",
            bt."txFee" AS "chainTxFee",
            bt."blockSize" AS "chainBlockSize",
            bt."timestamp" AS "chainTimestamp"
        FROM "Transaction" t
        LEFT JOIN "BlockTransaction" bt
          ON bt."txHash" = t."txHash"
        WHERE t."txHash" = '${String(txHash).replace(/'/g, "''")}'
        ORDER BY COALESCE(t."verifiedAt", t."timestamp") DESC
        LIMIT 1
    `);

    if (!rows?.[0]) return null;
    const [enriched] = await enrichTransactions(rows);
    return enriched || rows[0];
}

async function createTransaction({ walletId, buildingName, snid, type, tokenAmount, status }) {
    const numericTokenAmount = Number(tokenAmount || 0);

    return await prisma.transaction.create({
        data: {
            txid: randomUUID(),
            walletId: String(walletId),
            buildingName: buildingName ? String(buildingName) : null,
            snid: snid ? String(snid) : null,
            type: String(type || 'CREDIT'),
            tokenAmount: Number.isFinite(numericTokenAmount) ? numericTokenAmount : 0,
            status: String(status || 'CONFIRMED')
        }
    });
}

async function updateVerification(txid, verification = {}) {
    const existing = await prisma.transaction.findUnique({
        where: { txid: String(txid) },
        select: {
            verificationMethod: true,
            chainId: true,
            verificationPayload: true,
            payloadHash: true,
            txHash: true,
            explorerUrl: true,
            publisherAddress: true,
            contractAddress: true,
            blockNumber: true,
            gasUsed: true,
            effectiveGasPrice: true,
            verifiedAt: true,
        },
    });

    return await prisma.transaction.update({
        where: { txid: String(txid) },
        data: {
            verificationStatus: verification.verified
                ? 'VERIFIED'
                : String(verification.mode || 'UNVERIFIED').toUpperCase(),
            verificationMethod: verification.verificationMethod
                ? String(verification.verificationMethod)
                : (existing?.verificationMethod ?? null),
            chainId: Number.isInteger(Number(verification.chainId)) ? Number(verification.chainId) : (existing?.chainId ?? null),
            verificationPayload: verification.payload
                ? JSON.stringify(verification.payload)
                : (existing?.verificationPayload ?? null),
            payloadHash: verification.payloadHash ? String(verification.payloadHash) : (existing?.payloadHash ?? null),
            txHash: verification.txHash ? String(verification.txHash) : (existing?.txHash ?? null),
            explorerUrl: verification.explorerUrl ? String(verification.explorerUrl) : (existing?.explorerUrl ?? null),
            publisherAddress: verification.publisherAddress ? String(verification.publisherAddress) : (existing?.publisherAddress ?? null),
            contractAddress: verification.contractAddress ? String(verification.contractAddress) : (existing?.contractAddress ?? null),
            blockNumber: Number.isInteger(Number(verification.blockNumber)) ? Number(verification.blockNumber) : (existing?.blockNumber ?? null),
            gasUsed: verification.gasUsed ? String(verification.gasUsed) : (existing?.gasUsed ?? null),
            effectiveGasPrice: verification.effectiveGasPrice ? String(verification.effectiveGasPrice) : (existing?.effectiveGasPrice ?? null),
            verifiedAt: verification.verified ? new Date() : (existing?.verifiedAt ?? null),
        }
    });
}

module.exports = {
    getTransactions,
    getTransactionById,
    getTransactionsByBuilding,
    getTransactionsByWallet,
    getRecentBlockchainTransactions,
    getBlockchainTransactionByHash,
    createTransaction,
    updateVerification,
}


