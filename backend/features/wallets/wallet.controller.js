const walletService = require('./wallet.service');
const { dispatchNotification } = require('../notification/notification.service');

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

async function getWalletByBuildingId(req, res) {
    const { buildingId } = req.params;
    try {
        const wallet = await walletService.getWalletByBuildingId(buildingId);
        if (!wallet) {
            res.status(404).json({ error: 'Wallet not found for this building' });
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
    const { buildingId } = req.body;
    try {
        if (!buildingId) {
            return res.status(400).json({ error: 'buildingId is required' });
        }

        // Check if wallet already exists for this building
        const existingWallet = await walletService.getWalletByBuildingId(buildingId);
        if (existingWallet) {
            return res.status(200).json(existingWallet);
        }

        const newWallet = await walletService.createWallet({ buildingId });
        res.status(201).json(newWallet);
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to create wallet' });
    }
}

async function addBalance(req, res) {
    const { walletId } = req.params;
    const { amount } = req.body;
    try {
        const updatedWallet = await walletService.addBalanceByWalletId(walletId, amount);
        res.json(updatedWallet);

        // Fire-and-forget notification
        (async () => {
            try {
                const tokenAmount = Number(amount || 0);
                const currentBalance = Number(updatedWallet?.tokenBalance ?? 0);
                const text = `✅ เติมเงินเข้า Wallet\n+${tokenAmount.toLocaleString('en-US')} Token\nยอดคงเหลือ: ${currentBalance.toLocaleString('en-US')} Token`;
                await dispatchNotification({
                    type: 'addBalance',
                    message: text,
                    userId: null,
                });
            } catch (e) {
                console.error('Notification (addBalance) failed:', e?.message || e);
            }
        })();
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Failed to add balance' });
    }
}

async function topupByBuildingId(req, res) {
    const { buildingId } = req.params;
    const { amount, snid } = req.body;
    try {
        const result = await walletService.topupWalletByBuildingId(buildingId, amount, snid);
        res.status(201).json(result);

        // Fire-and-forget notification
        (async () => {
            try {
                let buildingName = result?.transaction?.buildingName;
                if (!buildingName || buildingName === 'Unknown building') {
                    try {
                        const { prisma: p } = require('../../utils/prisma');
                        const b = await p.building.findUnique({ where: { id: parseInt(buildingId) }, select: { name: true } });
                        if (b?.name) buildingName = b.name;
                    } catch {}
                }
                if (!buildingName || buildingName === 'Unknown building') {
                    buildingName = `Building-${buildingId}`;
                }
                const tokenAmount = Number((result?.transaction?.tokenAmount ?? amount) || 0);
                const currentBalance = Number(result?.wallet?.tokenBalance ?? 0);
                const text = `✅ เติมเงินเข้าอาคาร ${buildingName}\n+${tokenAmount.toLocaleString('en-US')} Token\nยอดคงเหลือ: ${currentBalance.toLocaleString('en-US')} Token`;
                await dispatchNotification({
                    type: 'topup',
                    message: text,
                    userId: null,
                });
            } catch (e) {
                console.error('Notification (topup) failed:', e?.message || e);
            }
        })();
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
    getWalletByBuildingId,
    getBalance,
    createWallet,
    addBalance,
    topupByBuildingId,
    getWalletTransactions,
    recalculateWalletBalance,
};
