const Wallet = require('../models/wallet.model');

async function getWallets(req, res) {
    try {
        const wallets = await Wallet.getWallets();
        res.json(wallets);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallets' });
    }
}

async function getWalletById(req, res) {
    const { id } = req.params;
    try {
        const wallet = await Wallet.getWalletById(id);
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
        const balance = await Wallet.getBalance(walletId);
        if (balance === null) {
            res.status(404).json({ error: 'Wallet not found' });
        } else {
            res.json({ walletId, balance: balance.tokenBalance });
        }
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to retrieve wallet balance' });
    }
}

module.exports = {
    getWallets,
    getWalletById,
    getBalance
};