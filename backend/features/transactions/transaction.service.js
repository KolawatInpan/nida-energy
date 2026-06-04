const { prisma } = require('../../utils/prisma');
const repo = require('./transaction.repository');
// Lazy-load these to avoid circular dependency hangs
const EthereumVerificationService = () => require('../blockchain/ethereumVerification.service');
const TransactionVerificationService = () => require('../blockchain/transactionVerification.service');

/**
 * Enrich transaction rows with building name / snid by resolving wallet→building mappings.
 */
async function enrichTransactions(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const walletIds = [...new Set(rows.map((r) => String(r?.walletId || '')).filter(Boolean))];
    const buildingNames = [...new Set(rows.map((r) => String(r?.buildingName || '')).filter(Boolean))];

    const [wallets, buildingsById, buildingsByName] = await Promise.all([
        walletIds.length ? prisma.wallet.findMany({ where: { id: { in: walletIds } }, select: { id: true, email: true } }) : [],
        walletIds.length ? prisma.building.findMany({
            where: { id: { in: walletIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)) } },
            select: { id: true, name: true, produceSN: true, consumeSN: true, batSN: true, email: true },
        }) : [],
        buildingNames.length ? prisma.building.findMany({
            where: { name: { in: buildingNames } },
            select: { id: true, name: true, produceSN: true, consumeSN: true, batSN: true, email: true },
        }) : [],
    ]);

    const walletById = new Map(wallets.map((w) => [String(w.id), w]));
    const buildingByWalletId = new Map(buildingsById.map((b) => [String(b.id), b]));
    const buildingByName = new Map(buildingsByName.map((b) => [String(b.name), b]));

    if (wallets.length) {
        const missingEmails = [...new Set(wallets.map((w) => String(w.email || '')).filter(Boolean))]
            .filter((email) => !Array.from(buildingByWalletId.values()).some((b) => String(b.email || '') === email));
        if (missingEmails.length) {
            const buildingsByEmail = await prisma.building.findMany({
                where: { email: { in: missingEmails } },
                select: { id: true, name: true, produceSN: true, consumeSN: true, batSN: true, email: true },
            });
            buildingsByEmail.forEach((b) => {
                const email = String(b.email || '');
                wallets.filter((w) => String(w.email || '') === email).forEach((w) => buildingByWalletId.set(String(w.id), b));
                buildingByName.set(String(b.name), b);
            });
        }
    }

    return rows.map((row) => {
        const walletId = String(row?.walletId || '');
        const existingName = row?.buildingName ? String(row.buildingName) : '';
        const building = (existingName && buildingByName.get(existingName)) || (walletId && buildingByWalletId.get(walletId)) || null;
        const fallbackSnid = building ? (building.consumeSN || building.produceSN || building.batSN || null) : null;
        return { ...row, buildingName: existingName || building?.name || null, snid: row?.snid || fallbackSnid || null };
    });
}

// ---- Orchestrated queries (repo + enrich) ----

async function getTransactions() {
  return repo.getTransactionsRaw();
}
async function getTransactionById(id) {
    const row = await repo.getTransactionByIdRaw(id);
    if (!row) return null;
    const [enriched] = await enrichTransactions([row]);
    return enriched || row;
}
async function getTransactionsByBuilding(name) { return enrichTransactions(await repo.getTransactionsByBuildingRaw(name)); }
async function getTransactionsByWallet(wid) { return enrichTransactions(await repo.getTransactionsByWalletRaw(wid)); }
async function getRecentBlockchainTransactions(limit) { return enrichTransactions(await repo.getRecentBlockchainTransactionsRaw(limit)); }
async function getBlockchainTransactionByHash(hash) {
    const row = await repo.getBlockchainTransactionByHashRaw(hash);
    if (!row) return null;
    const [enriched] = await enrichTransactions([row]);
    return enriched || row;
}

async function createTransaction({ walletId, buildingName, snid, type, tokenAmount, status }) {
    const created = await repo.createTransaction({ walletId, buildingName, snid, type, tokenAmount, status });
    const { transaction, verification } = await TransactionVerificationService().verifyTransaction(created);
    return { transaction, verification };
}

async function getTransactionVerificationPreview(id) {
    const transaction = await getTransactionById(id);
    if (!transaction) throw Object.assign(new Error('transaction not found'), { status: 404 });
    return EthereumVerificationService().getVerificationPreview(transaction);
}

async function publishTransactionVerification(id, opts = {}) {
    const { transaction, verification } = await TransactionVerificationService().verifyTransactionById(id, opts);
    return { transaction, verification };
}

module.exports = {
    enrichTransactions,
    getTransactions, getTransactionById, getTransactionsByBuilding, getTransactionsByWallet,
    getRecentBlockchainTransactions, getBlockchainTransactionByHash,
    createTransaction, getTransactionVerificationPreview, publishTransactionVerification,
};
