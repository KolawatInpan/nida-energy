const service = require('./transaction.service');

async function getTransactions(req, res) {
    try {
        const transactions = await service.getTransactions();
        res.json(transactions);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getTransactionById(req, res) {
    try {
        const t = await service.getTransactionById(req.params.id);
        if (!t) return res.status(404).json({ error: 'transaction not found' });
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getTransactionsByBuilding(req, res) {
    try {
        const list = await service.getTransactionsByBuilding(req.params.buildingName);
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getTransactionsByWallet(req, res) {
    try {
        const list = await service.getTransactionsByWallet(req.params.walletId);
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createTransaction(req, res) {
    try {
        const { walletId, buildingName, snid, type, tokenAmount, status } = req.body;
        if (!walletId || tokenAmount == null) return res.status(400).json({ error: 'walletId and tokenAmount are required' });
        const result = await service.createTransaction({ walletId, buildingName, snid, type, tokenAmount, status });
        res.status(201).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getRecentBlockchainTransactions(req, res) {
    try {
        const limit = Number(req.query.limit || 50);
        const list = await service.getRecentBlockchainTransactions(limit);
        res.json({ items: list, count: list.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getBlockchainTransactionByHash(req, res) {
    try {
        const t = await service.getBlockchainTransactionByHash(req.params.txHash);
        if (!t) return res.status(404).json({ error: 'blockchain transaction not found' });
        res.json(t);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getTransactionVerificationPreview(req, res) {
    try {
        const preview = await service.getTransactionVerificationPreview(req.params.id);
        res.json({ transactionId: req.params.id, ...preview });
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

async function publishTransactionVerification(req, res) {
    try {
        const result = await service.publishTransactionVerification(req.params.id, {
            force: req.query.force === 'true' || req.body?.force === true,
        });
        res.status(result.verification.published ? 201 : 200).json(result);
    } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

module.exports = {
    getTransactions, getTransactionById, getTransactionsByBuilding, getTransactionsByWallet,
    createTransaction, getRecentBlockchainTransactions, getBlockchainTransactionByHash,
    getTransactionVerificationPreview, publishTransactionVerification,
};
