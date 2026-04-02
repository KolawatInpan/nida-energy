const walletService = require('./wallet.service');

async function getWallets(req, res) {
    try {
        const wallets = await walletService.getWallets();
        res.json(wallets);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallets' });
    }
}

async function getWalletById(req, res) {
    const { id } = req.params;
    try {
        const wallet = await walletService.getWalletById(id);
        if (!wallet) {
            res.status(404).json({ error: 'Wallet not found' });
        } else {
            res.json(wallet);
        }
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet' });
    }
}

async function getBalance(req, res) {
    const { walletId } = req.params;
    try {
        const result = await walletService.resolveWalletBalance(walletId);
        res.json(result);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet balance' });
    }
}

async function createWallet(req, res) {
    const { buildingId, email } = req.body;
    try {
        const newWallet = await walletService.createWallet({ buildingId, email });
        res.status(201).json(newWallet);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to create wallet' });
    }
}

async function getWalletByEmail(req, res) {
    const { email } = req.params;
    try {
        const wallet = await walletService.getWalletByEmail(email);
        if (!wallet) {
            return res.status(404).json({ error: 'Wallet not found' });
        }
        res.json(wallet);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet by email' });
    }
}

async function addBalance(req, res) {
    const { email } = req.params;
    const { amount, rate } = req.body;
    try {
        const updatedWallet = await walletService.addBalance(email, amount, rate);
        res.json(updatedWallet);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to add balance' });
    }
}

async function topupByEmail(req, res) {
    const { email } = req.params;
    const { amount, snid } = req.body;
    try {
        const result = await walletService.topupWalletByEmail(email, amount, snid);
        res.status(201).json(result);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to top up wallet' });
    }
}

async function getWalletTransactions(req, res) {
    const { walletId } = req.params;
    try {
        const txs = await walletService.getWalletTransactions(walletId);
        res.json(txs);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to get wallet transactions' });
    }
}

async function recalculateWalletBalance(req, res) {
    const { walletId } = req.params;
    try {
        const result = await walletService.recalculateBalance(walletId);
        res.json(result);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to recalculate wallet balance' });
    }
}

module.exports = {
    getWallets,
    getWalletById,
    getWalletByEmail,
    getBalance,
    createWallet,
    addBalance,
    topupByEmail,
    getWalletTransactions,
    recalculateWalletBalance
};


