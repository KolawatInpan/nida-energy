const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

// ---- Raw DB queries ----

async function getTransactionsRaw() {
    return await prisma.transaction.findMany({ orderBy: { timestamp: 'desc' } });
}

async function getTransactionByIdRaw(id) {
    return await prisma.transaction.findUnique({ where: { txid: String(id) } });
}

async function getTransactionsByBuildingRaw(buildingName) {
    return await prisma.transaction.findMany({
        where: { buildingName: String(buildingName) },
        orderBy: { timestamp: 'desc' },
    });
}

async function getTransactionsByWalletRaw(walletId) {
    return await prisma.transaction.findMany({
        where: { walletId: String(walletId) },
        orderBy: { timestamp: 'desc' },
    });
}

async function getRecentBlockchainTransactionsRaw(limit = 50) {
    const take = Math.max(1, Math.min(Number(limit) || 50, 200));
    return await prisma.$queryRawUnsafe(`
        SELECT
            t."id" AS "txid", t."timestamp", t."buildingName", t."snid", t."walletId",
            t."type", t."amount" AS "tokenAmount", t."status",
            t."verificationStatus", t."verificationMethod", t."chainId",
            t."verificationPayload", t."payloadHash", t."txHash", t."explorerUrl",
            t."publisherAddress", t."contractAddress", t."blockNumber",
            t."gasUsed", t."effectiveGasPrice", t."verifiedAt",
            bt."id" AS "blockTransactionId", bt."blockHash" AS "chainBlockHash",
            bt."parentHash" AS "chainParentHash", bt."txFee" AS "chainTxFee",
            bt."blockSize" AS "chainBlockSize", bt."timestamp" AS "chainTimestamp"
        FROM "Transaction" t
        LEFT JOIN "BlockTransaction" bt ON bt."txHash" = t."txHash"
        WHERE t."txHash" IS NOT NULL
        ORDER BY COALESCE(t."verifiedAt", t."timestamp") DESC, t."timestamp" DESC
        LIMIT ${take}
    `);
}

async function getBlockchainTransactionByHashRaw(txHash) {
    if (!txHash) return null;
    const rows = await prisma.$queryRawUnsafe(`
        SELECT t.*, t."id" AS "txid", t."amount" AS "tokenAmount",
            bt."id" AS "blockTransactionId", bt."blockHash" AS "chainBlockHash",
            bt."parentHash" AS "chainParentHash", bt."txFee" AS "chainTxFee",
            bt."blockSize" AS "chainBlockSize", bt."timestamp" AS "chainTimestamp"
        FROM "Transaction" t
        LEFT JOIN "BlockTransaction" bt ON bt."txHash" = t."txHash"
        WHERE t."txHash" = '${String(txHash).replace(/'/g, "''")}'
        ORDER BY COALESCE(t."verifiedAt", t."timestamp") DESC
        LIMIT 1
    `);
    return rows?.[0] || null;
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
            status: String(status || 'CONFIRMED'),
        },
    });
}

async function updateVerification(txid, verification = {}) {
    const existing = await prisma.transaction.findUnique({
        where: { txid: String(txid) },
        select: {
            verificationMethod: true, chainId: true, verificationPayload: true,
            payloadHash: true, txHash: true, explorerUrl: true,
            publisherAddress: true, contractAddress: true, blockNumber: true,
            gasUsed: true, effectiveGasPrice: true, verifiedAt: true,
        },
    });
    return await prisma.transaction.update({
        where: { txid: String(txid) },
        data: {
            verificationStatus: verification.verified ? 'VERIFIED' : String(verification.mode || 'UNVERIFIED').toUpperCase(),
            verificationMethod: verification.verificationMethod ? String(verification.verificationMethod) : (existing?.verificationMethod ?? null),
            chainId: Number.isInteger(Number(verification.chainId)) ? Number(verification.chainId) : (existing?.chainId ?? null),
            verificationPayload: verification.payload ? JSON.stringify(verification.payload) : (existing?.verificationPayload ?? null),
            payloadHash: verification.payloadHash ? String(verification.payloadHash) : (existing?.payloadHash ?? null),
            txHash: verification.txHash ? String(verification.txHash) : (existing?.txHash ?? null),
            explorerUrl: verification.explorerUrl ? String(verification.explorerUrl) : (existing?.explorerUrl ?? null),
            publisherAddress: verification.publisherAddress ? String(verification.publisherAddress) : (existing?.publisherAddress ?? null),
            contractAddress: verification.contractAddress ? String(verification.contractAddress) : (existing?.contractAddress ?? null),
            blockNumber: Number.isInteger(Number(verification.blockNumber)) ? Number(verification.blockNumber) : (existing?.blockNumber ?? null),
            gasUsed: verification.gasUsed ? String(verification.gasUsed) : (existing?.gasUsed ?? null),
            effectiveGasPrice: verification.effectiveGasPrice ? String(verification.effectiveGasPrice) : (existing?.effectiveGasPrice ?? null),
            verifiedAt: verification.verified ? new Date() : (existing?.verifiedAt ?? null),
        },
    });
}

module.exports = {
    getTransactionsRaw,
    getTransactionByIdRaw,
    getTransactionsByBuildingRaw,
    getTransactionsByWalletRaw,
    getRecentBlockchainTransactionsRaw,
    getBlockchainTransactionByHashRaw,
    createTransaction,
    updateVerification,
};
